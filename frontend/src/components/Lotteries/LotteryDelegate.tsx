import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { lotteryApi } from '../../lib/supabaseLottery';
import { LOTTERY_PAYMENT_METHODS } from '../../lib/lotteryPaymentMethods';
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

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function playersLabel(gender: string | null | undefined): string {
  const g = (gender || '').toLowerCase();
  if (g === 'fem' || g === 'femenino' || g === 'female') return 'Jugadoras';
  if (g === 'masc' || g === 'masculino' || g === 'male') return 'Jugadores';
  if (g === 'mixto' || g === 'mixed') return 'Jugadores/as';
  return 'Jugadores/as';
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
  const [soldCountInput, setSoldCountInput] = useState('');
  const [collectedAmountInput, setCollectedAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>(LOTTERY_PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingTacoPlayerId, setUpdatingTacoPlayerId] = useState<string | null>(null);

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
      soldCount: players.reduce((total, player) => total + player.tickets_sold, 0),
      unsoldCount: players.reduce((total, player) => total + player.tickets_unsold, 0),
      delivered: players.reduce((total, player) => total + player.delivered, 0),
    };
  }, [data]);

  const getVendidoNoCobrado = (player: DelegatePlayer): number => {
    const donationPerTicket = data?.lottery.donation_per_ticket ?? 0;
    const donacionVendidas = player.tickets_sold * donationPerTicket;
    const clubPendienteVendido = Math.max(donacionVendidas - player.club_received, 0);
    return roundMoney(player.pending_lottery + clubPendienteVendido);
  };

  const openCollection = (player: DelegatePlayer) => {
    setCollectionPlayer(player);
    setLotteryAmount('');
    setClubAmount('');
    setSoldCountInput('');
    setCollectedAmountInput('');
    setPaymentMethod(LOTTERY_PAYMENT_METHODS[0]);
    setNotes('');
  };

  useEffect(() => {
    if (!data) return;
    if (soldCountInput === '' || collectedAmountInput === '') {
      setClubAmount('');
      setLotteryAmount('');
      return;
    }
    const cantidad = Number(soldCountInput);
    const importe = parseAmount(collectedAmountInput);
    if (!Number.isInteger(cantidad) || cantidad <= 0 || !Number.isFinite(importe) || importe < 0) {
      setClubAmount('');
      setLotteryAmount('');
      return;
    }
    const ticketPrice = data.lottery.ticket_price;
    const donationPerTicket = data.lottery.donation_per_ticket;
    const lotteryPerTicket = ticketPrice - donationPerTicket;
    const esperado = cantidad * ticketPrice;
    if (Math.abs(importe - esperado) <= 0.005) {
      setClubAmount(roundMoney(cantidad * donationPerTicket).toFixed(2));
      setLotteryAmount(roundMoney(cantidad * lotteryPerTicket).toFixed(2));
    } else if (importe < esperado - 0.005) {
      setClubAmount('');
      setLotteryAmount('');
    } else {
      const loteria = roundMoney(cantidad * lotteryPerTicket);
      const club = roundMoney(importe - loteria);
      setClubAmount(club.toFixed(2));
      setLotteryAmount(loteria.toFixed(2));
    }
  }, [soldCountInput, collectedAmountInput, data?.lottery.ticket_price, data?.lottery.donation_per_ticket, data]);

  const collectionLottery = parseAmount(lotteryAmount);
  const collectionClub = parseAmount(clubAmount);
  const collectionTotal = collectionLottery + collectionClub;
  const invalidAmount =
    collectionLottery < 0 || collectionClub < 0 || collectionTotal <= 0;

  const handleSharePlayer = async (player: DelegatePlayer) => {
    if (!data) return;
    const url = `${window.location.origin}/j/${player.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: data.lottery.name,
          text: `Venta de papeletas - ${player.player_name} · ${data.lottery.name}`,
          url,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await dialog.alert({
      title: 'Enlace copiado',
      message: url,
      variant: 'success',
    });
  };

  const handleTacoDeliveryChange = async (
    player: DelegatePlayer,
    field: 'taco_fisico_entregado' | 'taco_virtual_entregado',
    checked: boolean,
  ) => {
    if (!token || !data) return;
    const previous = data.players;
    const nextFisico = field === 'taco_fisico_entregado' ? checked : player.taco_fisico_entregado;
    const nextVirtual = field === 'taco_virtual_entregado' ? checked : player.taco_virtual_entregado;
    setUpdatingTacoPlayerId(player.player_id);
    setData({
      ...data,
      players: data.players.map((p) =>
        p.player_id === player.player_id
          ? { ...p, taco_fisico_entregado: nextFisico, taco_virtual_entregado: nextVirtual }
          : p,
      ),
    });
    try {
      await lotteryApi.setDelegateTacoDelivery(token, player.player_id, nextFisico, nextVirtual);
    } catch (updateError) {
      setData((current) => (current ? { ...current, players: previous } : current));
      await dialog.alert({
        title: 'No se pudo actualizar',
        message:
          updateError instanceof Error
            ? updateError.message
            : 'No se pudo actualizar la entrega del taco',
        variant: 'danger',
      });
    } finally {
      setUpdatingTacoPlayerId(null);
    }
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

  const participantLabel = playersLabel(data.delegate.team_gender);

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
              <div className="text-[10px] text-gray-500">{participantLabel}</div>
            </div>
            <div>
              <div className="text-xl font-bold text-purple-600">{totals.soldCount}</div>
              <div className="text-[10px] text-gray-500">Nros Vendidos</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-600">{money(totals.delivered)}</div>
              <div className="text-[10px] text-gray-500">Cobrado</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-600">{totals.unsoldCount}</div>
              <div className="text-[10px] text-gray-500">Nros Pendientes</div>
            </div>
          </div>
        </div>

        {data.players.length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center text-sm text-gray-500 shadow-lg">
            No hay {participantLabel.toLowerCase()} participantes en este equipo.
          </div>
        ) : (
          <div className="space-y-2">
            {data.players.map((player) => {
              const vendidoNoCobrado = getVendidoNoCobrado(player);
              return (
                <div key={player.player_id} className="bg-white rounded-xl p-3 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">{player.player_name}</p>
                      <p className="text-xs text-gray-500">
                        {player.tickets_sold} vendidas · {player.tickets_unsold} pendientes
                      </p>
                      <p className="text-xs text-gray-500">
                        Cobrado {money(player.delivered)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Vendido no cobrado {money(vendidoNoCobrado)}
                      </p>
                    </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-bold ${vendidoNoCobrado > 0.005 ? 'text-orange-600' : 'text-emerald-600'}`}
                    >
                      {money(vendidoNoCobrado)}
                    </p>
                    <div className="mt-1 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => openCollection(player)}
                        disabled={player.pending_amount <= 0.005}
                        className="rounded-lg bg-sanse-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                      >
                        Cobrar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSharePlayer(player)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Compartir enlace
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs text-gray-700">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!player.taco_fisico_entregado}
                      disabled={updatingTacoPlayerId === player.player_id}
                      onChange={(event) =>
                        handleTacoDeliveryChange(
                          player,
                          'taco_fisico_entregado',
                          event.target.checked,
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-sanse-blue focus:ring-sanse-blue disabled:opacity-50"
                    />
                    <span>Taco Físico</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!player.taco_virtual_entregado}
                      disabled={updatingTacoPlayerId === player.player_id}
                      onChange={(event) =>
                        handleTacoDeliveryChange(
                          player,
                          'taco_virtual_entregado',
                          event.target.checked,
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-sanse-blue focus:ring-sanse-blue disabled:opacity-50"
                    />
                    <span>Taco Virtual</span>
                  </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {collectionPlayer && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Cobro de {collectionPlayer.player_name}</h2>
              <p className="text-sm text-gray-500">Delegado {data.delegate.team_name}</p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 p-2">
                <div className="font-bold text-emerald-700">{money(collectionPlayer.delivered)}</div>
                <div className="text-[10px] text-gray-500">Cobrado</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <div className="font-bold text-orange-700">
                  {money(getVendidoNoCobrado(collectionPlayer))}
                </div>
                <div className="text-[10px] text-gray-500">Vendido no cobrado</div>
              </div>
            </div>

            <form onSubmit={handleCollection} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Cantidad papeletas vendidas
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={soldCountInput}
                    onChange={(event) => setSoldCountInput(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Importe cobrado
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={collectedAmountInput}
                    onChange={(event) => setCollectedAmountInput(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Donativo Club</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={clubAmount}
                    onChange={(event) => setClubAmount(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2"
                  />
                </div>
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
