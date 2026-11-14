import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { lotteryApi } from '../../lib/supabaseLottery';
import { LOTTERY_PAYMENT_METHODS } from '../../lib/lotteryPaymentMethods';
import { splitPendingSeller } from '../../lib/lotteryAmounts';
import { DelegatePageData, DelegatePlayer } from '../../types/lottery';
import { useAppDialog } from '../AppDialog';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

function money(value: number | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

function parseAmount(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

const LotteryDelegate: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const dialog = useAppDialog();
  const [data, setData] = useState<DelegatePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collectionPlayer, setCollectionPlayer] = useState<DelegatePlayer | null>(null);
  const [lotteryAmount, setLotteryAmount] = useState('');
  const [clubAmount, setClubAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>(LOTTERY_PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    lotteryApi
      .getDelegatePage(token)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setError('Este enlace de delegado no es válido o ha caducado.');
          setData(null);
          return;
        }
        setData(result);
        setError('');
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudo cargar el enlace de delegado',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const totals = useMemo(() => {
    const players = data?.players ?? [];
    return {
      expected: players.reduce((total, player) => total + player.expected, 0),
      delivered: players.reduce((total, player) => total + player.delivered, 0),
      pending: players.reduce((total, player) => total + player.pending_amount, 0),
    };
  }, [data]);

  const pendingSplit = useMemo(() => {
    if (!data || !collectionPlayer) return null;
    return splitPendingSeller(
      {
        ...collectionPlayer,
        sold: collectionPlayer.tickets_sold,
        total: collectionPlayer.tickets_assigned,
      },
      {
        ticketPrice: data.lottery.ticket_price,
        donationPerTicket: data.lottery.donation_per_ticket,
      },
    );
  }, [data, collectionPlayer]);

  const openCollection = (player: DelegatePlayer) => {
    if (!data) return;
    const split = splitPendingSeller(
      { ...player, sold: player.tickets_sold, total: player.tickets_assigned },
      {
        ticketPrice: data.lottery.ticket_price,
        donationPerTicket: data.lottery.donation_per_ticket,
      },
    );
    setCollectionPlayer(player);
    setLotteryAmount(split.lottery.toFixed(2));
    setClubAmount(split.club.toFixed(2));
    setPaymentMethod(LOTTERY_PAYMENT_METHODS[0]);
    setNotes('');
  };

  const collectionLottery = parseAmount(lotteryAmount);
  const collectionClub = parseAmount(clubAmount);
  const collectionTotal = collectionLottery + collectionClub;
  const collectionPending = pendingSplit?.total ?? 0;
  const collectionRemaining = Math.max(collectionPending - collectionTotal, 0);
  const collectionOver = Math.max(collectionTotal - collectionPending, 0);
  const invalidAmount =
    collectionLottery < 0 ||
    collectionClub < 0 ||
    collectionTotal <= 0 ||
    collectionOver > 0.005;

  const applyFullCollection = () => {
    if (!pendingSplit) return;
    setLotteryAmount(pendingSplit.lottery.toFixed(2));
    setClubAmount(pendingSplit.club.toFixed(2));
  };

  const handleCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !collectionPlayer || invalidAmount) return;
    setSaving(true);
    try {
      await lotteryApi.registerDelegateCollection(
        token,
        collectionPlayer.player_id,
        collectionLottery,
        collectionClub,
        paymentMethod,
        notes,
      );
      await dialog.alert({
        title: 'Cobro registrado',
        message: `Se han registrado ${money(collectionTotal)} de ${collectionPlayer.player_name}.`,
        variant: 'success',
      });
      setCollectionPlayer(null);
      const result = await lotteryApi.getDelegatePage(token);
      setData(result);
    } catch (saveError) {
      await dialog.alert({
        title: 'No se pudo registrar el cobro',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'No se pudo registrar el cobro',
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 flex items-center justify-center p-4">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-md w-full">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Enlace no válido</h1>
          <p className="text-gray-600">{error || 'No se encontró el enlace de delegado.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-sanse-blue to-blue-700 p-3 pb-10 sm:p-4">
      <div className="max-w-md mx-auto min-w-0">
        <div className="text-center mb-5">
          <img
            src="/images/logosanse2.png"
            alt="Sanse Complutense"
            className="w-16 h-16 mx-auto mb-2 object-contain"
          />
          <h1 className="text-2xl font-bold text-white">{data.lottery.name}</h1>
          <p className="text-blue-200 text-sm">Delegado {data.delegate.team_name}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div>
              <div className="text-xl font-bold text-sanse-blue">{data.players.length}</div>
              <div className="text-[10px] text-gray-500">Jugadoras</div>
            </div>
            <div>
              <div className="text-xl font-bold text-purple-600">{money(totals.expected)}</div>
              <div className="text-[10px] text-gray-500">Esperado</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-600">{money(totals.delivered)}</div>
              <div className="text-[10px] text-gray-500">Cobrado</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-600">{money(totals.pending)}</div>
              <div className="text-[10px] text-gray-500">Pendiente</div>
            </div>
          </div>
        </div>

        {data.players.length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center text-sm text-gray-500 shadow-lg">
            No hay jugadoras participantes en este equipo.
          </div>
        ) : (
          <div className="space-y-2">
            {data.players.map((player) => (
              <div key={player.player_id} className="bg-white rounded-xl p-3 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{player.player_name}</p>
                    <p className="text-xs text-gray-500">
                      {player.tickets_sold} vendidas · {player.tickets_unsold} pendientes
                    </p>
                    <p className="text-xs text-gray-500">
                      Esperado {money(player.expected)} · Cobrado {money(player.delivered)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-bold ${player.pending_amount > 0.005 ? 'text-orange-600' : 'text-emerald-600'}`}
                    >
                      {player.pending_amount > 0.005
                        ? money(player.pending_amount)
                        : 'Cobrado'}
                    </p>
                    <button
                      type="button"
                      onClick={() => openCollection(player)}
                      disabled={player.pending_amount <= 0.005}
                      className="mt-1 rounded-lg bg-sanse-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      Cobrar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {collectionPlayer && pendingSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Cobro de {collectionPlayer.player_name}</h2>
              <p className="text-sm text-gray-500">Delegado {data.delegate.team_name}</p>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 p-2">
                <div className="font-bold text-purple-700">{money(collectionPlayer.expected)}</div>
                <div className="text-[10px] text-gray-500">Esperado</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <div className="font-bold text-emerald-700">{money(collectionPlayer.delivered)}</div>
                <div className="text-[10px] text-gray-500">Cobrado</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <div className="font-bold text-orange-700">{money(collectionPlayer.pending_amount)}</div>
                <div className="text-[10px] text-gray-500">Pendiente</div>
              </div>
            </div>

            <form onSubmit={handleCollection} className="space-y-4">
              <button
                type="button"
                onClick={applyFullCollection}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
              >
                Cobrar todo
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Lotería</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={lotteryAmount}
                    onChange={(event) => setLotteryAmount(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Club</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={clubAmount}
                    onChange={(event) => setClubAmount(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Forma de pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2"
                >
                  {LOTTERY_PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2"
                  placeholder="Bizum, pendiente, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-gray-200 p-2">
                  <div className="font-bold text-sanse-blue">{money(collectionTotal)}</div>
                  <div className="text-[10px] text-gray-500">Total a registrar</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-2">
                  <div className="font-bold text-orange-700">{money(collectionRemaining)}</div>
                  <div className="text-[10px] text-gray-500">Queda pendiente</div>
                </div>
              </div>

              {collectionOver > 0.005 && (
                <p className="text-sm text-red-600">
                  El importe supera el pendiente de {money(collectionPending)}.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || invalidAmount}
                  className="flex-1 rounded-lg bg-sanse-blue px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Registrando...' : 'Registrar cobro'}
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionPlayer(null)}
                  disabled={saving}
                  className="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotteryDelegate;
