import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { lotteryAdminApi, getLotteryAdminSession } from '../../lib/lotteryAdmin';
import {
  getTicketAmounts,
  splitSettlementReceived,
} from '../../lib/lotteryAmounts';
import { LotteryAdminData, LotterySettlement } from '../../types/lottery';
import BackButton from '../BackButton';
import { useAppDialog } from '../AppDialog';
import { PhysicalTicketBadge } from './PhysicalTicketBadge';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

function money(value: number | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const LotterySales: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dialog = useAppDialog();
  const [data, setData] = useState<LotteryAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [showVoid, setShowVoid] = useState(false);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!getLotteryAdminSession()) {
        throw new Error('Sesión de administración caducada. Vuelve a iniciar sesión.');
      }
      const result = await lotteryAdminApi.get(id!);
      setData(result);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  const purchases = data?.purchases ?? [];
  const sellers = data?.sellers ?? [];
  const settlements = data?.settlements ?? [];
  const ticketAmounts = useMemo(
    () =>
      getTicketAmounts({
        ticketPrice: data?.lottery.ticket_price ?? 0,
        donationPerTicket: data?.lottery.donation_per_ticket ?? 0,
      }),
    [data],
  );

  const filtered = useMemo(() => {
    const term = normalize(search);
    return purchases.filter((purchase) => {
      if (!showVoid && purchase.status === 'void') return false;
      if (sellerFilter !== 'all' && purchase.seller_id !== sellerFilter) return false;
      if (!term) return true;
      const haystack = [
        purchase.buyer_name,
        purchase.seller_name ?? '',
        ...purchase.ticket_numbers.map((number) => String(number)),
      ]
        .map(normalize)
        .join(' ');
      return haystack.includes(term);
    });
  }, [purchases, search, sellerFilter, showVoid]);

  const stats = useMemo(() => {
    const confirmed = purchases.filter((purchase) => purchase.status === 'confirmed');
    return {
      sold: confirmed.reduce((total, purchase) => total + purchase.quantity, 0),
      revenue: confirmed.reduce((total, purchase) => total + purchase.total_amount, 0),
      donation: confirmed.reduce((total, purchase) => total + purchase.donation_amount, 0),
      buyers: new Set(confirmed.map((purchase) => purchase.buyer_name.toLowerCase())).size,
    };
  }, [purchases]);

  const history = useMemo(
    () =>
      settlements
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [settlements],
  );

  const handleAnnul = async (purchaseId: string, buyerName: string) => {
    const confirmed = await dialog.confirm({
      title: 'Anular venta',
      message: `¿Anular la venta de ${buyerName}? Los números volverán a estar disponibles.`,
      confirmLabel: 'Anular venta',
      destructive: true,
    });
    if (!confirmed) return;
    setBusyId(purchaseId);
    try {
      await lotteryAdminApi.annulSale(purchaseId);
      await loadData();
    } catch (annulError) {
      await dialog.alert({
        title: 'No se pudo anular la venta',
        message:
          annulError instanceof Error ? annulError.message : 'No se pudo anular la venta',
        variant: 'danger',
      });
    } finally {
      setBusyId('');
    }
  };

  const handleVoidCollection = async (settlement: LotterySettlement) => {
    const reason = await dialog.prompt({
      title: 'Anular cobro',
      message: `¿Anular el cobro de ${money(settlement.delivered_amount)}?`,
      label: 'Motivo de la anulación',
      required: true,
      multiline: true,
      confirmLabel: 'Anular cobro',
      destructive: true,
    });
    if (reason === null) return;
    setBusyId(settlement.id);
    try {
      await lotteryAdminApi.voidCollection(settlement.id, reason.trim());
      await loadData();
    } catch (voidError) {
      await dialog.alert({
        title: 'No se pudo anular el cobro',
        message:
          voidError instanceof Error ? voidError.message : 'No se pudo anular el cobro',
        variant: 'danger',
      });
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton to={`/lotteries/${id}`} />
          <div className="text-center py-8">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton to={`/lotteries/${id}`} />
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mt-4">
            {error || 'Lotería no encontrada'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <BackButton to={`/lotteries/${id}`} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold text-sanse-blue">Ventas - {data.lottery.name}</h1>
            <p className="text-gray-600">Ventas inmediatas, recibos y anulaciones</p>
          </div>
          <button
            onClick={() => window.open(`/lotteries/${id}`, '_self')}
            className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Volver a la lotería
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">{error}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-sanse-blue">{stats.sold}</div>
            <div className="text-sm text-gray-600">Papeletas vendidas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{money(stats.revenue)}</div>
            <div className="text-sm text-gray-600">Total vendido</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{money(stats.donation)}</div>
            <div className="text-sm text-gray-600">Donativo de ventas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.buyers}</div>
            <div className="text-sm text-gray-600">Compradores</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar comprador, vendedor o número..."
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="w-full md:w-64">
              <select
                value={sellerFilter}
                onChange={(event) => setSellerFilter(event.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Todos los vendedores</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.player_id}>{seller.player_name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showVoid}
                onChange={(event) => setShowVoid(event.target.checked)}
                className="h-4 w-4"
              />
              Ver anuladas
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Comprador</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Vendedor</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Números</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">P. física</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Pago comprador</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Importe</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No hay ventas que mostrar
                    </td>
                  </tr>
                ) : (
                  filtered.map((purchase) => (
                    <tr
                      key={purchase.id}
                      className={`border-t ${purchase.status === 'void' ? 'bg-red-50/50 text-gray-400' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(purchase.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium">{purchase.buyer_name}</td>
                      <td className="px-4 py-3">{purchase.seller_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {purchase.ticket_numbers.map((number) => (
                            <span key={number} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">
                              {number.toString().padStart(4, '0')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PhysicalTicketBadge delivered={purchase.physical_ticket_delivered} />
                      </td>
                      <td className="px-4 py-3">{purchase.buyer_payment_method || '-'}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{money(purchase.total_amount)}</td>
                      <td className="px-4 py-3">
                        {purchase.status === 'void' ? (
                          <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs">Anulada</span>
                        ) : purchase.collection_status === 'collected' ? (
                          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs">Cobrada</span>
                        ) : purchase.collection_status === 'partial' ? (
                          <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs">Parcial</span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">Confirmada</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => window.open(`/r/${purchase.token}`, '_blank')}
                            className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
                          >
                            Recibo
                          </button>
                          {purchase.status === 'confirmed' && (
                            <button
                              onClick={() => handleAnnul(purchase.id, purchase.buyer_name)}
                              disabled={
                                busyId === purchase.id ||
                                (purchase.collection_status !== undefined &&
                                  purchase.collection_status !== 'confirmed')
                              }
                              title={
                                purchase.collection_status &&
                                purchase.collection_status !== 'confirmed'
                                  ? 'La jugadora tiene cobros registrados. Anula primero los cobros'
                                  : 'Anular venta'
                              }
                              className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-40"
                            >
                              {busyId === purchase.id ? '...' : 'Anular'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-1">Historial de cobros</h2>
          <p className="text-sm text-gray-500 mb-3">
            Cada cobro se reparte automáticamente entre Lotería y Club. Los cobros en remesa no se
            pueden anular hasta anular la remesa.
          </p>
          {history.length === 0 ? (
            <p className="text-gray-500">Todavía no hay cobros registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Jugador</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Lotería</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Club</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Total</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Cobro jugadora</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Estado</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Notas</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((settlement) => {
                    const settlementSplit = splitSettlementReceived(
                      settlement,
                      ticketAmounts,
                    );
                    return (
                      <tr
                        key={settlement.id}
                        className={`border-t ${settlement.status === 'void' ? 'bg-red-50/40 text-gray-400' : ''}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(settlement.created_at)}</td>
                        <td className="px-3 py-2">{settlement.player_name}</td>
                        <td className="px-3 py-2">{money(settlementSplit.lottery)}</td>
                        <td className="px-3 py-2">{money(settlementSplit.club)}</td>
                        <td className="px-3 py-2 font-bold text-emerald-700">{money(settlement.delivered_amount)}</td>
                        <td className="px-3 py-2">{settlement.payment_method || '-'}</td>
                        <td className="px-3 py-2">
                          {settlement.status === 'void' ? (
                            <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs">Anulado</span>
                          ) : settlement.treasurer_delivery_id ? (
                            <span className="px-2 py-1 rounded bg-teal-100 text-teal-700 text-xs">En remesa</span>
                          ) : (
                            <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs">Confirmado</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {settlement.status === 'void' && settlement.void_reason
                            ? `Anulado: ${settlement.void_reason}`
                            : settlement.notes || '-'}
                        </td>
                        <td className="px-3 py-2">
                          {settlement.status !== 'void' && !settlement.treasurer_delivery_id && (
                            <button
                              onClick={() => handleVoidCollection(settlement)}
                              disabled={busyId === settlement.id}
                              className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                            >
                              {busyId === settlement.id ? '...' : 'Anular'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LotterySales;
