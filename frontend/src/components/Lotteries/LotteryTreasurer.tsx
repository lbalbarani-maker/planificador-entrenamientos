import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { lotteryApi } from '../../lib/supabaseLottery';
import { TreasurerPageData, TreasurerPlayer, TreasurerTeam } from '../../types/lottery';
import { useAppDialog } from '../AppDialog';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

function money(value: number | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

const LotteryTreasurer: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const dialog = useAppDialog();
  const [pin, setPin] = useState('');
  const [sessionPin, setSessionPin] = useState('');
  const [data, setData] = useState<TreasurerPageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);

  const selectedTeam = useMemo(
    () => data?.teams.find((team) => String(team.team_id ?? 'none') === selectedTeamId) ?? null,
    [data, selectedTeamId],
  );

  const loadData = async (pinValue: string): Promise<boolean> => {
    if (!token) return false;
    setLoading(true);
    try {
      const result = await lotteryApi.getTreasurerPage(token, pinValue);
      setData(result);
      setSessionPin(pinValue);
      setError('');
      return true;
    } catch (loadError) {
      setData(null);
      setSessionPin('');
      setError(
        loadError instanceof Error ? loadError.message : 'No se pudo acceder a tesorería',
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError('Introduce un PIN de 6 dígitos.');
      return;
    }
    await loadData(pin);
  };

  const handleReceive = async (team: TreasurerTeam, player?: TreasurerPlayer) => {
    if (!token || !sessionPin) return;
    const teamKey = team.team_id;
    if (!teamKey) {
      await dialog.alert({
        title: 'Equipo no válido',
        message: 'No se puede registrar la recepción para el grupo sin equipo.',
        variant: 'danger',
      });
      return;
    }
    const amount = player ? player.delegate_pending_amount : team.delegate_pending_amount;
    if (amount <= 0.005) return;
    const label = player ? player.player_name : `el equipo ${team.team_name}`;
    const confirmed = await dialog.confirm({
      title: 'Confirmar recepción',
      message: `¿Registrar la recepción de ${money(amount)} entregados por el delegado para ${label}?`,
      confirmLabel: 'Registrar recepción',
      cancelLabel: 'Cancelar',
      variant: 'warning',
    });
    if (!confirmed) return;

    setReceiving(true);
    try {
      const result = await lotteryApi.receiveTreasurerFromDelegate(
        token,
        sessionPin,
        teamKey,
        player ? [player.player_id] : null,
        '',
      );
      await dialog.alert({
        title: 'Recepción registrada',
        message: `Se han registrado ${money(result.amount)} en tesorería.`,
        variant: 'success',
      });
      await loadData(sessionPin);
    } catch (receiveError) {
      await dialog.alert({
        title: 'No se pudo registrar',
        message:
          receiveError instanceof Error
            ? receiveError.message
            : 'No se pudo registrar la recepción',
        variant: 'danger',
      });
    } finally {
      setReceiving(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-md w-full">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Enlace no válido</h1>
          <p className="text-gray-600">Falta el identificador de tesorería.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
          <div className="text-center mb-5">
            <img
              src="/images/logosanse2.png"
              alt="Sanse Complutense"
              className="w-14 h-14 mx-auto mb-2 object-contain"
            />
            <h1 className="text-xl font-bold text-gray-800">Modo tesorería</h1>
            <p className="text-sm text-gray-500">Introduce el PIN de 6 dígitos</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="PIN"
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-lg tracking-[0.3em]"
              autoFocus
            />
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || pin.length !== 6}
              className="w-full rounded-lg bg-sanse-blue px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totals = data.totals;

  const TeamCard = ({ team }: { team: TreasurerTeam }) => (
    <div className="bg-white rounded-xl p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-gray-800">{team.team_name}</p>
          <p className="text-xs text-gray-500">
            {team.player_count} jugadora{team.player_count === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedTeamId(String(team.team_id ?? 'none'))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Ver detalle
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs text-gray-700 mb-2">
        <div>Vendidas: <strong>{team.tickets_sold}</strong></div>
        <div>No vendidas: <strong>{team.tickets_unsold}</strong></div>
        <div>Cobradas: <strong>{team.tickets_collected}</strong></div>
        <div>Por cobrar: <strong>{team.tickets_pending_collect}</strong></div>
        <div>A lotería: <strong>{money(team.lottery_expected)}</strong></div>
        <div>Club: <strong>{money(team.club_expected)}</strong></div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-[11px] mb-2">
        <div className="rounded bg-amber-50 p-1"><div className="font-semibold text-amber-700">{money(team.player_pending_amount)}</div><div className="text-gray-500">Jugador</div></div>
        <div className="rounded bg-blue-50 p-1"><div className="font-semibold text-blue-700">{money(team.delegate_pending_amount)}</div><div className="text-gray-500">Delegado</div></div>
        <div className="rounded bg-emerald-50 p-1"><div className="font-semibold text-emerald-700">{money(team.treasurer_received_amount)}</div><div className="text-gray-500">Tesorería</div></div>
      </div>
      {team.team_id && team.delegate_pending_amount > 0.005 && (
        <button
          type="button"
          onClick={() => handleReceive(team)}
          disabled={receiving}
          className="w-full rounded-lg bg-sanse-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Registrar recepción del delegado
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-sanse-blue to-blue-700 p-3 pb-10 sm:p-4">
      <div className="max-w-md mx-auto min-w-0">
        <div className="text-center mb-4">
          <img src="/images/logosanse2.png" alt="Sanse Complutense" className="w-14 h-14 mx-auto mb-2 object-contain" />
          <h1 className="text-2xl font-bold text-white">{data.lottery.name}</h1>
          <p className="text-blue-200 text-sm">Modo tesorería</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
          <div className="grid grid-cols-2 gap-2 text-center mb-2">
            <div><div className="text-lg font-bold text-sanse-blue">{totals.tickets_sold}</div><div className="text-[10px] text-gray-500">Vendidas</div></div>
            <div><div className="text-lg font-bold text-gray-600">{totals.tickets_unsold}</div><div className="text-[10px] text-gray-500">No vendidas</div></div>
            <div><div className="text-lg font-bold text-emerald-600">{totals.tickets_collected}</div><div className="text-[10px] text-gray-500">Cobradas</div></div>
            <div><div className="text-lg font-bold text-orange-600">{totals.tickets_pending_collect}</div><div className="text-[10px] text-gray-500">Por cobrar</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center mb-2 text-sm">
            <div className="rounded bg-purple-50 p-2"><div className="font-bold text-purple-700">{money(totals.lottery_expected)}</div><div className="text-[10px] text-gray-500">A lotería</div></div>
            <div className="rounded bg-blue-50 p-2"><div className="font-bold text-blue-700">{money(totals.club_expected)}</div><div className="text-[10px] text-gray-500">Club</div></div>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
            <div className="rounded bg-amber-50 p-1"><div className="font-semibold text-amber-700">{money(totals.player_pending_amount)}</div><div className="text-gray-500">Jugador</div></div>
            <div className="rounded bg-sky-50 p-1"><div className="font-semibold text-sky-700">{money(totals.delegate_pending_amount)}</div><div className="text-gray-500">Delegado</div></div>
            <div className="rounded bg-emerald-50 p-1"><div className="font-semibold text-emerald-700">{money(totals.treasurer_received_amount)}</div><div className="text-gray-500">Tesorería</div></div>
          </div>
        </div>

        {selectedTeam ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSelectedTeamId(null)}
              className="text-sm text-white/90 underline"
            >
              ← Volver a equipos
            </button>
            <div className="bg-white rounded-xl p-3 shadow-lg">
              <h2 className="font-bold text-gray-800 mb-2">{selectedTeam.team_name}</h2>
              {selectedTeam.team_id && selectedTeam.delegate_pending_amount > 0.005 && (
                <button
                  type="button"
                  onClick={() => handleReceive(selectedTeam)}
                  disabled={receiving}
                  className="w-full mb-2 rounded-lg bg-sanse-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Registrar recepción del delegado (equipo)
                </button>
              )}
              <div className="space-y-2">
                {selectedTeam.players.map((player) => (
                  <div key={player.player_id} className="rounded-lg border border-gray-200 p-2">
                    <p className="font-medium text-gray-800 text-sm">{player.player_name}</p>
                    <p className="text-xs text-gray-600">
                      Vendidas {player.tickets_sold} · No vend. {player.tickets_unsold} · Cobradas {player.tickets_collected} · Por cobrar {player.tickets_pending_collect}
                    </p>
                    <p className="text-xs text-gray-600">
                      A lotería {money(player.lottery_expected)} · Club {money(player.club_expected)}
                    </p>
                    <div className="mt-1 grid grid-cols-3 gap-1 text-center text-[10px]">
                      <div className="rounded bg-amber-50 p-1"><div className="font-semibold text-amber-700">{money(player.player_pending_amount)}</div><div className="text-gray-500">Jugador</div></div>
                      <div className="rounded bg-blue-50 p-1"><div className="font-semibold text-blue-700">{money(player.delegate_pending_amount)}</div><div className="text-gray-500">Delegado</div></div>
                      <div className="rounded bg-emerald-50 p-1"><div className="font-semibold text-emerald-700">{money(player.treasurer_received_amount)}</div><div className="text-gray-500">Tesorería</div></div>
                    </div>
                    {selectedTeam.team_id && player.delegate_pending_amount > 0.005 && (
                      <button
                        type="button"
                        onClick={() => handleReceive(selectedTeam, player)}
                        disabled={receiving}
                        className="mt-2 w-full rounded-lg border border-sanse-blue px-3 py-1.5 text-sm font-semibold text-sanse-blue hover:bg-blue-50 disabled:opacity-50"
                      >
                        Registrar recepción (jugadora)
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {data.teams.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 text-center text-sm text-gray-500 shadow-lg">
                No hay datos de equipos para esta lotería.
              </div>
            ) : (
              data.teams.map((team) => <TeamCard key={String(team.team_id ?? team.team_name)} team={team} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LotteryTreasurer;
