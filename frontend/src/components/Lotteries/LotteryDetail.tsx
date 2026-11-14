import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { lotteryAdminApi, getLotteryAdminSession } from '../../lib/lotteryAdmin';
import {
  formatTicketCount,
  getTicketAmounts,
  roundMoney,
  splitExpectedSeller,
  splitPendingSeller,
  splitReceivedSeller,
  splitSettlementReceived,
} from '../../lib/lotteryAmounts';
import { downloadCsv, printReport } from '../../lib/lotteryReport';
import { LOTTERY_PAYMENT_METHODS } from '../../lib/lotteryPaymentMethods';
import {
  LotteryAdminData,
  LotterySeller,
  LotterySettlement,
  LotteryTreasurerDelivery,
  TicketBlock,
} from '../../types/lottery';
import BackButton from '../BackButton';
import { useAppDialog } from '../AppDialog';
import DelegatesModal from './DelegatesModal';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

const SALES_FILTER_OPTIONS = [
  { value: 'all', label: 'Todas las ventas' },
  { value: 'sin_ventas', label: 'Sin ventas' },
  { value: 'con_ventas', label: 'Con ventas' },
];

const RECON_FILTER_OPTIONS = [
  { value: 'all', label: 'Toda la conciliación' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'de_mas', label: 'Entregado de más' },
  { value: 'exento', label: 'Exento' },
  { value: 'sin_obligacion', label: 'Sin obligación' },
];

const RECON_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  entregado: 'Entregado',
  de_mas: 'Entregado de más',
  exento: 'Exento',
  sin_obligacion: 'Sin obligación',
};

const RECON_BADGES: Record<string, string> = {
  pendiente: 'bg-red-100 text-red-700',
  parcial: 'bg-amber-100 text-amber-700',
  entregado: 'bg-emerald-100 text-emerald-700',
  de_mas: 'bg-purple-100 text-purple-700',
  exento: 'bg-slate-100 text-slate-700',
  sin_obligacion: 'bg-gray-100 text-gray-600',
};

interface ReportData {
  title: string;
  subtitle: string;
  summary: Array<{ label: string; value: string }>;
  columns: string[];
  rows: string[][];
  filename: string;
}

interface DeliverySnapshotSettlement {
  settlement_id?: string;
  player_id?: string;
  sales_received?: number;
  donation_received?: number;
  lottery_received?: number;
  club_received?: number;
  total_received?: number;
  created_at?: string;
}

type ReportMode = 'filtered' | 'consolidated' | 'delivery';
type CollectionMode = 'all' | 'sales' | 'donation';

function money(value: number | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

function pad(value: number): string {
  return Number(value).toString().padStart(4, '0');
}

function parseAmount(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sumSellers(list: LotterySeller[], selector: (seller: LotterySeller) => number): number {
  return list.reduce((total, seller) => total + Number(selector(seller) ?? 0), 0);
}

const LotteryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dialog = useAppDialog();
  const [data, setData] = useState<LotteryAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDelegatesModal, setShowDelegatesModal] = useState(false);
  const [assignBlock, setAssignBlock] = useState<TicketBlock | null>(null);
  const [assignPlayerId, setAssignPlayerId] = useState('');
  const [showAllBlocks, setShowAllBlocks] = useState(false);

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [salesFilter, setSalesFilter] = useState('all');
  const [reconFilter, setReconFilter] = useState('all');

  const [collectionSeller, setCollectionSeller] = useState<LotterySeller | null>(null);
  const [collectionMode, setCollectionMode] = useState<CollectionMode>('all');
  const [collectionTickets, setCollectionTickets] = useState('');
  const [collectionMethod, setCollectionMethod] = useState<string>(LOTTERY_PAYMENT_METHODS[0]);
  const [collectionNotes, setCollectionNotes] = useState('');

  const [waiverSeller, setWaiverSeller] = useState<LotterySeller | null>(null);
  const [waiverAmount, setWaiverAmount] = useState('');
  const [waiverReason, setWaiverReason] = useState('');

  const [treasurySelected, setTreasurySelected] = useState<Set<string>>(new Set());
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const [showReport, setShowReport] = useState(false);
  const [reportMode, setReportMode] = useState<ReportMode>('filtered');
  const [reportDeliveryId, setReportDeliveryId] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadData(false);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [id]);

  const loadData = async (showLoader = true): Promise<LotteryAdminData | null> => {
    if (showLoader) setLoading(true);
    try {
      if (!getLotteryAdminSession()) {
        throw new Error('Sesión de administración caducada. Vuelve a iniciar sesión.');
      }
      const result = await lotteryAdminApi.get(id!);
      setData(result);
      setTreasurySelected((current) => {
        const next = new Set(
          Array.from(current).filter((playerId) =>
            result.sellers.some(
              (seller) => seller.player_id === playerId && seller.treasury_pending > 0.005,
            ),
          ),
        );
        return next;
      });
      setError('');
      return result;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la lotería');
      return null;
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const lottery = data?.lottery;
  const stats = lottery?.stats ?? {};
  const sellers = data?.sellers ?? [];
  const blocks = data?.blocks ?? [];
  const settlements = data?.settlements ?? [];
  const deliveries = data?.deliveries ?? [];

  const sortedSellers = useMemo(
    () =>
      [...sellers].sort((a, b) =>
        a.player_name.localeCompare(b.player_name, 'es', { sensitivity: 'base' }),
      ),
    [sellers],
  );

  const ticketAmounts = useMemo(
    () =>
      getTicketAmounts({
        ticketPrice: lottery?.ticket_price ?? 0,
        donationPerTicket: lottery?.donation_per_ticket ?? 0,
      }),
    [lottery?.ticket_price, lottery?.donation_per_ticket],
  );

  const teams = useMemo(
    () => Array.from(new Set(sellers.flatMap((seller) => seller.team_names))).sort((a, b) => a.localeCompare(b, 'es')),
    [sellers],
  );

  const unassignedBlocks = useMemo(() => blocks.filter((block) => !block.player_id), [blocks]);
  const blocksByPlayer = useMemo(() => {
    const map = new Map<string, TicketBlock[]>();
    blocks.forEach((block) => {
      if (!block.player_id) return;
      const current = map.get(block.player_id) ?? [];
      current.push(block);
      map.set(block.player_id, current);
    });
    return map;
  }, [blocks]);

  const visibleUnassigned = showAllBlocks ? unassignedBlocks : unassignedBlocks.slice(0, 40);

  const filteredSellers = useMemo(() => {
    const term = normalize(search);
    return sortedSellers.filter((seller) => {
      if (salesFilter === 'sin_ventas' && seller.sold > 0) return false;
      if (salesFilter === 'con_ventas' && seller.sold === 0) return false;
      if (reconFilter !== 'all' && seller.reconciliation_state !== reconFilter) return false;
      if (teamFilter !== 'all' && !seller.team_names.includes(teamFilter)) return false;
      if (!term) return true;
      const haystack = [seller.player_name, ...seller.team_names].map(normalize).join(' ');
      return haystack.includes(term);
    });
  }, [sortedSellers, search, salesFilter, reconFilter, teamFilter]);

  const pendingTreasurySellers = useMemo(
    () => sortedSellers.filter((seller) => seller.treasury_pending > 0.005),
    [sortedSellers],
  );

  const selectedTreasurySellers = useMemo(
    () => pendingTreasurySellers.filter((seller) => treasurySelected.has(seller.player_id)),
    [pendingTreasurySellers, treasurySelected],
  );

  const selectedTreasuryTotal = sumSellers(
    selectedTreasurySellers,
    (seller) => seller.treasury_pending,
  );

  const allTreasurySelected =
    pendingTreasurySellers.length > 0 &&
    selectedTreasurySellers.length === pendingTreasurySellers.length;

  const collectionSettlements = useMemo(
    () =>
      collectionSeller
        ? settlements
            .filter((settlement) => settlement.player_id === collectionSeller.player_id)
            .slice()
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            )
        : [],
    [collectionSeller, settlements],
  );

  const collectionExpectedSplit = collectionSeller
    ? splitExpectedSeller(collectionSeller, ticketAmounts)
    : { lottery: 0, club: 0, total: 0 };
  const collectionReceivedSplit = collectionSeller
    ? splitReceivedSeller(collectionSeller, ticketAmounts)
    : { lottery: 0, club: 0, total: 0 };
  const collectionPendingSplit = collectionSeller
    ? splitPendingSeller(collectionSeller, ticketAmounts)
    : { total: 0, lottery: 0, club: 0, tickets: 0, sales: 0, unsoldDonation: 0 };
  const collectionPendingLottery = collectionPendingSplit.lottery;
  const collectionPendingClub = collectionPendingSplit.club;
  const collectionPendingSales = collectionPendingSplit.sales;
  const collectionPendingTickets = collectionPendingSplit.tickets;
  const collectionSuggestedSplit = collectionPendingSplit;
  const collectionRequestedTickets = parseAmount(collectionTickets);
  const collectionTicketsToCollect =
    collectionMode === 'donation'
      ? 0
      : Math.min(Math.max(collectionRequestedTickets, 0), collectionPendingTickets);
  const collectionPending = collectionSeller?.pending_amount ?? collectionPendingSplit.total;
  const collectionRequestedLottery = roundMoney(
    collectionTicketsToCollect * ticketAmounts.lotteryPerTicket,
  );
  const collectionRequestedClub =
    collectionMode === 'sales' ? 0 : collectionPendingClub;
  const collectionTotal = roundMoney(
    Math.min(collectionRequestedLottery + collectionRequestedClub, collectionPending),
  );
  const collectionLottery = roundMoney(Math.min(collectionRequestedLottery, collectionTotal));
  const collectionClub = roundMoney(Math.max(collectionTotal - collectionLottery, 0));
  const collectionRemaining = Math.max(roundMoney(collectionPending - collectionTotal), 0);
  const collectionOver = Math.max(roundMoney(collectionTotal - collectionPending), 0);
  const collectionTicketsOver =
    collectionMode !== 'donation' &&
    collectionRequestedTickets > collectionPendingTickets + 0.005;

  const statsExpectedSplit = splitExpectedSeller(
    {
      sold: sumSellers(sellers, (seller) => seller.sold),
      total: sumSellers(sellers, (seller) => seller.tickets_assigned),
    },
    ticketAmounts,
  );
  const statsReceivedSplit = {
    lottery: roundMoney(Number(stats.lotteryReceived ?? stats.salesReceived ?? 0)),
    club: roundMoney(Number(stats.clubReceived ?? stats.donationReceived ?? 0)),
    total: roundMoney(Number(stats.delivered ?? 0)),
  };

  const waiverMax = waiverSeller
    ? Math.max(waiverSeller.expected - waiverSeller.delivered, 0)
    : 0;

  const reportData = useMemo<ReportData | null>(() => {
    if (!lottery) return null;
    const generatedAt = new Date().toLocaleString('es-ES');

    if (reportMode === 'delivery') {
      const delivery = deliveries.find((row) => row.id === reportDeliveryId);
      if (!delivery) return null;

      const snapshot = delivery.snapshot as
        | { settlements?: DeliverySnapshotSettlement[] }
        | undefined;
      const linkedSettlements = settlements.filter(
        (settlement) =>
          settlement.treasurer_delivery_id === delivery.id && settlement.status !== 'void',
      );
      const sourceRows: DeliverySnapshotSettlement[] =
        snapshot?.settlements && snapshot.settlements.length > 0
          ? snapshot.settlements
          : linkedSettlements.map((settlement) => ({
              settlement_id: settlement.id,
              player_id: settlement.player_id,
              sales_received: settlement.sales_received,
              donation_received: settlement.donation_received,
              lottery_received: settlement.lottery_received,
              club_received: settlement.club_received,
              total_received: settlement.delivered_amount,
              created_at: settlement.created_at,
            }));

      const grouped = new Map<
        string,
        { lottery: number; club: number; total: number; count: number; last: string }
      >();
      sourceRows.forEach((settlement) => {
        if (!settlement.player_id) return;
        const createdAt = settlement.created_at ?? new Date().toISOString();
        const current = grouped.get(settlement.player_id) ?? {
          lottery: 0,
          club: 0,
          total: 0,
          count: 0,
          last: createdAt,
        };
        const split = splitSettlementReceived(settlement, ticketAmounts);
        current.lottery = roundMoney(current.lottery + split.lottery);
        current.club = roundMoney(current.club + split.club);
        current.total = roundMoney(current.total + split.total);
        current.count += 1;
        current.last =
          new Date(createdAt).getTime() > new Date(current.last).getTime()
            ? createdAt
            : current.last;
        grouped.set(settlement.player_id, current);
      });

      const deliveryTotals = { lottery: 0, club: 0 };
      const rows = Array.from(grouped.entries()).map(([playerId, item]) => {
        const seller = sellers.find((row) => row.player_id === playerId);
        deliveryTotals.lottery = roundMoney(deliveryTotals.lottery + item.lottery);
        deliveryTotals.club = roundMoney(deliveryTotals.club + item.club);
        return [
          seller?.player_name ?? 'Jugador',
          seller?.team_names.join(', ') || 'Sin equipo',
          String(item.count),
          money(item.lottery),
          money(item.club),
          money(item.total),
          formatDate(item.last),
        ];
      });

      return {
        title: `Remesa al tesorero · ${lottery.name}`,
        subtitle: `${formatDate(delivery.delivered_at)} · ${delivery.notes || 'Sin notas'}`,
        summary: [
          { label: 'Importe de la remesa', value: money(delivery.amount) },
          { label: 'Lotería', value: money(deliveryTotals.lottery) },
          { label: 'Club', value: money(deliveryTotals.club) },
          { label: 'Jugadores', value: String(delivery.player_count ?? 0) },
          { label: 'Cobros incluidos', value: String(delivery.settlement_count ?? 0) },
          {
            label: 'Estado',
            value: delivery.status === 'void' ? 'Anulada' : 'Confirmada',
          },
        ],
        columns: [
          'Jugador',
          'Equipos',
          'Cobros',
          'Lotería',
          'Club',
          'Total remesa',
          'Último cobro',
        ],
        rows,
        filename: `remesa-${delivery.id.slice(0, 8)}.csv`,
      };
    }

    if (reportMode === 'consolidated') {
      const rows = sortedSellers.map((seller) => {
        const expectedSplit = splitExpectedSeller(seller, ticketAmounts);
        const receivedSplit = splitReceivedSeller(seller, ticketAmounts);
        return [
          seller.player_name,
          seller.team_names.join(', ') || 'Sin equipo',
          money(expectedSplit.lottery),
          money(expectedSplit.club),
          money(seller.expected),
          money(receivedSplit.lottery),
          money(receivedSplit.club),
          money(seller.delivered),
          money(seller.waived_amount),
          money(seller.treasury_delivered),
          money(seller.treasury_pending),
          seller.treasury_state === 'pendiente'
            ? 'Pendiente'
            : seller.treasury_state === 'liquidado'
              ? 'Liquidado'
              : 'Sin cobros',
        ];
      });

      const expectedSplit = splitExpectedSeller(
        {
          sold: sumSellers(sellers, (seller) => seller.sold),
          total: sumSellers(sellers, (seller) => seller.tickets_assigned),
        },
        ticketAmounts,
      );
      const receivedSplit = statsReceivedSplit;

      return {
        title: `Reporte consolidado de tesorería · ${lottery.name}`,
        subtitle: `Generado el ${generatedAt}`,
        summary: [
          { label: 'Lotería esperada', value: money(expectedSplit.lottery) },
          { label: 'Club esperado', value: money(expectedSplit.club) },
          { label: 'Total esperado', value: money(stats.expected) },
          { label: 'Lotería cobrada', value: money(receivedSplit.lottery) },
          { label: 'Club cobrado', value: money(receivedSplit.club) },
          { label: 'Total cobrado', value: money(stats.delivered) },
          { label: 'Condonado', value: money(stats.waived) },
          { label: 'Pendiente conciliación', value: money(stats.pending) },
          { label: 'Liquidado tesorería', value: money(stats.treasuryDelivered) },
          { label: 'Pendiente tesorería', value: money(stats.treasuryPending) },
          { label: 'Remesas', value: String(stats.deliveries ?? 0) },
        ],
        columns: [
          'Jugador',
          'Equipos',
          'Lotería esp.',
          'Club esp.',
          'Total esp.',
          'Lotería cob.',
          'Club cob.',
          'Total cob.',
          'Condonado',
          'Liquidado tesorería',
          'Pendiente tesorería',
          'Estado tesorería',
        ],
        rows,
        filename: `tesoreria-consolidada-${lottery.id.slice(0, 8)}.csv`,
      };
    }

    const filterParts = [
      search.trim() ? `Búsqueda: ${search.trim()}` : '',
      teamFilter !== 'all' ? `Equipo: ${teamFilter}` : '',
      salesFilter !== 'all'
        ? `Ventas: ${SALES_FILTER_OPTIONS.find((option) => option.value === salesFilter)?.label ?? salesFilter}`
        : '',
      reconFilter !== 'all'
        ? `Conciliación: ${RECON_LABELS[reconFilter] ?? reconFilter}`
        : '',
    ].filter(Boolean);

    const rows = filteredSellers.map((seller) => {
      const expectedSplit = splitExpectedSeller(seller, ticketAmounts);
      const receivedSplit = splitReceivedSeller(seller, ticketAmounts);
      return [
        seller.player_name,
        seller.team_names.join(', ') || 'Sin equipo',
        String(seller.tacos),
        String(seller.sold),
        String(seller.available),
        money(expectedSplit.lottery),
        money(expectedSplit.club),
        money(seller.expected),
        money(receivedSplit.lottery),
        money(receivedSplit.club),
        money(seller.delivered),
        money(seller.waived_amount),
        money(seller.pending_amount),
        RECON_LABELS[seller.reconciliation_state] ?? seller.reconciliation_state,
        seller.treasury_state === 'pendiente'
          ? `Pendiente ${money(seller.treasury_pending)}`
          : seller.treasury_state === 'liquidado'
            ? 'Liquidado'
            : 'Sin cobros',
      ];
    });

    return {
      title: `Conciliación · ${lottery.name}`,
      subtitle: `${filterParts.length > 0 ? filterParts.join(' · ') : 'Todos los jugadores'} · ${generatedAt}`,
      summary: [
        { label: 'Jugadores', value: String(filteredSellers.length) },
        {
          label: 'Lotería esperada',
          value: money(
            sumSellers(
              filteredSellers,
              (seller) => splitExpectedSeller(seller, ticketAmounts).lottery,
            ),
          ),
        },
        {
          label: 'Club esperado',
          value: money(
            sumSellers(
              filteredSellers,
              (seller) => splitExpectedSeller(seller, ticketAmounts).club,
            ),
          ),
        },
        { label: 'Total esperado', value: money(sumSellers(filteredSellers, (seller) => seller.expected)) },
        {
          label: 'Lotería cobrada',
          value: money(
            sumSellers(
              filteredSellers,
              (seller) => splitReceivedSeller(seller, ticketAmounts).lottery,
            ),
          ),
        },
        {
          label: 'Club cobrado',
          value: money(
            sumSellers(
              filteredSellers,
              (seller) => splitReceivedSeller(seller, ticketAmounts).club,
            ),
          ),
        },
        { label: 'Total cobrado', value: money(sumSellers(filteredSellers, (seller) => seller.delivered)) },
        { label: 'Pendiente', value: money(sumSellers(filteredSellers, (seller) => seller.pending_amount)) },
        { label: 'Condonado', value: money(sumSellers(filteredSellers, (seller) => seller.waived_amount)) },
        {
          label: 'Pendiente tesorería',
          value: money(sumSellers(filteredSellers, (seller) => seller.treasury_pending)),
        },
      ],
      columns: [
        'Jugador',
        'Equipos',
        'Tacos',
        'Vendidas',
        'No vendidas',
        'Lotería esp.',
        'Club esp.',
        'Total esp.',
        'Lotería cob.',
        'Club cob.',
        'Total cob.',
        'Condonado',
        'Pendiente',
        'Estado conciliación',
        'Tesorería',
      ],
      rows,
      filename: `conciliacion-${lottery.id.slice(0, 8)}.csv`,
    };
  }, [
    lottery,
    reportMode,
    reportDeliveryId,
    deliveries,
    settlements,
    sellers,
    sortedSellers,
    filteredSellers,
    ticketAmounts,
    search,
    teamFilter,
    salesFilter,
    reconFilter,
    stats,
  ]);

  const toggleTreasury = (playerId: string) => {
    setTreasurySelected((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const toggleAllTreasury = () => {
    if (allTreasurySelected) {
      setTreasurySelected(new Set<string>());
      return;
    }
    setTreasurySelected(new Set(pendingTreasurySellers.map((seller) => seller.player_id)));
  };

  const openAssign = (block: TicketBlock | null) => {
    setAssignBlock(block);
    setAssignPlayerId('');
    setShowAssignModal(true);
  };

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignBlock || !assignPlayerId) return;
    setBusy(true);
    try {
      await lotteryAdminApi.assign(assignBlock.id, assignPlayerId);
      setShowAssignModal(false);
      await loadData(false);
    } catch (assignError) {
      await dialog.alert({
        title: 'No se pudo asignar el taco',
        message:
          assignError instanceof Error ? assignError.message : 'No se pudo asignar el taco',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUnassign = async (block: TicketBlock) => {
    if ((block.sold ?? 0) > 0) {
      await dialog.alert({
        title: 'No se puede quitar el taco',
        message: 'No se puede quitar un taco con papeletas vendidas.',
        variant: 'warning',
      });
      return;
    }
    const confirmed = await dialog.confirm({
      title: 'Quitar taco',
      message: `¿Quitar el taco ${pad(block.start_number)} - ${pad(block.end_number)} a ${block.player_name ?? 'este jugador'}?`,
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await lotteryAdminApi.assign(block.id, null);
      await loadData(false);
    } catch (unassignError) {
      await dialog.alert({
        title: 'No se pudo quitar el taco',
        message:
          unassignError instanceof Error ? unassignError.message : 'No se pudo quitar el taco',
        variant: 'danger',
      });
    }
  };

  const handleAutoAssign = async () => {
    if (!lottery) return;
    const confirmed = await dialog.confirm({
      title: 'Repartir tacos',
      message: '¿Repartir todos los tacos sin asignar entre los jugadores activos del club?',
      confirmLabel: 'Repartir',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const assigned = await lotteryAdminApi.autoAssign(lottery.id, lottery.club_id);
      await dialog.alert({
        title: 'Tacos asignados',
        message: `Se asignaron ${assigned} tacos.`,
        variant: 'success',
      });
      await loadData(false);
    } catch (autoError) {
      await dialog.alert({
        title: 'No se pudo asignar automáticamente',
        message:
          autoError instanceof Error
            ? autoError.message
            : 'No se pudo asignar automáticamente',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!lottery) return;
    const label = status === 'open' ? 'abrir' : 'cerrar';
    const confirmed = await dialog.confirm({
      title: `${status === 'open' ? 'Abrir' : 'Cerrar'} venta`,
      message: `¿Quieres ${label} la venta de esta lotería?`,
      confirmLabel: status === 'open' ? 'Abrir' : 'Cerrar',
      destructive: status !== 'open',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await lotteryAdminApi.setStatus(lottery.id, status);
      await loadData(false);
    } catch (statusError) {
      await dialog.alert({
        title: 'No se pudo cambiar el estado',
        message:
          statusError instanceof Error ? statusError.message : 'No se pudo cambiar el estado',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const openCollection = (seller: LotterySeller) => {
    const pending = splitPendingSeller(seller, ticketAmounts);
    setCollectionSeller(seller);
    setCollectionMode('all');
    setCollectionTickets(formatTicketCount(pending.tickets));
    setCollectionMethod(LOTTERY_PAYMENT_METHODS[0]);
    setCollectionNotes('');
  };

  const applyCollectionShortcut = (kind: CollectionMode) => {
    if (!collectionSeller) return;
    setCollectionMode(kind);
    setCollectionTickets(
      kind === 'donation' ? '0' : formatTicketCount(collectionPendingTickets),
    );
  };

  const handleCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lottery || !collectionSeller) return;
    if (collectionRequestedTickets < 0) {
      await dialog.alert({
        title: 'Importe no válido',
        message: 'Las papeletas a cobrar no pueden ser negativas.',
        variant: 'warning',
      });
      return;
    }
    if (collectionTicketsOver) {
      await dialog.alert({
        title: 'Demasiadas papeletas',
        message: `Solo quedan ${formatTicketCount(collectionPendingTickets)} papeletas pendientes de cobro.`,
        variant: 'warning',
      });
      return;
    }
    if (collectionTotal <= 0) {
      await dialog.alert({
        title: 'Importe no válido',
        message: 'Introduce un cobro mayor que 0.',
        variant: 'warning',
      });
      return;
    }
    setBusy(true);
    try {
      await lotteryAdminApi.registerCollection({
        lotteryId: lottery.id,
        playerId: collectionSeller.player_id,
        lotteryReceived: collectionLottery,
        clubReceived: collectionClub,
        paymentMethod: collectionMethod,
        notes: collectionNotes,
      });
      const fresh = await loadData(false);
      const updated = fresh?.sellers.find(
        (seller) => seller.player_id === collectionSeller.player_id,
      );
      await dialog.alert({
        title: 'Cobro registrado',
        message: updated
          ? `Lotería ${money(collectionLottery)} · Club ${money(collectionClub)}. Pendiente actual: ${money(updated.pending_amount)}.`
          : 'El cobro se ha registrado correctamente.',
        variant: 'success',
      });
      setCollectionSeller(null);
    } catch (collectionError) {
      await dialog.alert({
        title: 'No se pudo registrar el cobro',
        message:
          collectionError instanceof Error
            ? collectionError.message
            : 'No se pudo registrar el cobro',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      await lotteryAdminApi.voidCollection(settlement.id, reason.trim());
      const fresh = await loadData(false);
      if (collectionSeller) {
        setCollectionSeller(
          fresh?.sellers.find((seller) => seller.player_id === collectionSeller.player_id) ??
            null,
        );
      }
    } catch (voidError) {
      await dialog.alert({
        title: 'No se pudo anular el cobro',
        message:
          voidError instanceof Error ? voidError.message : 'No se pudo anular el cobro',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const openWaiver = (seller: LotterySeller) => {
    setWaiverSeller(seller);
    setWaiverAmount(
      seller.waived_amount > 0
        ? seller.waived_amount.toFixed(2)
        : seller.pending_amount.toFixed(2),
    );
    setWaiverReason(seller.waiver_reason ?? '');
  };

  const handleWaiver = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lottery || !waiverSeller) return;
    const amount = parseAmount(waiverAmount);
    if (amount < 0) {
      await dialog.alert({
        title: 'Importe no válido',
        message: 'El importe condonado no puede ser negativo.',
        variant: 'warning',
      });
      return;
    }
    if (amount > waiverMax + 0.005) {
      await dialog.alert({
        title: 'Condonación no válida',
        message: `La condonación máxima actual es ${money(waiverMax)}.`,
        variant: 'warning',
      });
      return;
    }
    if (amount > 0 && !waiverReason.trim()) {
      await dialog.alert({
        title: 'Falta el motivo',
        message: 'Indica el motivo de la condonación.',
        variant: 'warning',
      });
      return;
    }
    setBusy(true);
    try {
      await lotteryAdminApi.setWaiver({
        lotteryId: lottery.id,
        playerId: waiverSeller.player_id,
        amount,
        reason: waiverReason.trim(),
      });
      const fresh = await loadData(false);
      const updated = fresh?.sellers.find(
        (seller) => seller.player_id === waiverSeller.player_id,
      );
      await dialog.alert({
        title: 'Condonación guardada',
        message: updated
          ? `Pendiente actual: ${money(updated.pending_amount)}.`
          : 'La condonación se ha guardado correctamente.',
        variant: 'success',
      });
      setWaiverSeller(null);
    } catch (waiverError) {
      await dialog.alert({
        title: 'No se pudo guardar la condonación',
        message:
          waiverError instanceof Error
            ? waiverError.message
            : 'No se pudo guardar la condonación',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleClearWaiver = async () => {
    if (!lottery || !waiverSeller) return;
    const confirmed = await dialog.confirm({
      title: 'Quitar condonación',
      message: '¿Quitar la condonación de este jugador?',
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await lotteryAdminApi.voidWaiver(lottery.id, waiverSeller.player_id);
      await loadData(false);
      setWaiverSeller(null);
    } catch (waiverError) {
      await dialog.alert({
        title: 'No se pudo quitar la condonación',
        message:
          waiverError instanceof Error
            ? waiverError.message
            : 'No se pudo quitar la condonación',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDelivery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lottery || selectedTreasurySellers.length === 0) return;
    setBusy(true);
    try {
      const result = await lotteryAdminApi.createTreasurerDelivery({
        lotteryId: lottery.id,
        playerIds: selectedTreasurySellers.map((seller) => seller.player_id),
        notes: deliveryNotes,
      });
      const fresh = await loadData(false);
      setShowDeliveryModal(false);
      setTreasurySelected(new Set<string>());
      setDeliveryNotes('');
      if (fresh?.deliveries.some((delivery) => delivery.id === result.delivery_id)) {
        setReportDeliveryId(result.delivery_id);
        setReportMode('delivery');
        setShowReport(true);
      }
    } catch (deliveryError) {
      await dialog.alert({
        title: 'No se pudo crear la entrega',
        message:
          deliveryError instanceof Error
            ? deliveryError.message
            : 'No se pudo crear la entrega al tesorero',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleVoidDelivery = async (delivery: LotteryTreasurerDelivery) => {
    const reason = await dialog.prompt({
      title: 'Anular remesa',
      message: `¿Anular la remesa de ${money(delivery.amount)}? Los cobros volverán a estar pendientes de tesorería.`,
      label: 'Motivo de la anulación',
      required: true,
      multiline: true,
      confirmLabel: 'Anular remesa',
      destructive: true,
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await lotteryAdminApi.voidTreasurerDelivery(delivery.id, reason.trim());
      await loadData(false);
    } catch (deliveryError) {
      await dialog.alert({
        title: 'No se pudo anular la remesa',
        message:
          deliveryError instanceof Error
            ? deliveryError.message
            : 'No se pudo anular la remesa',
        variant: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadReport = () => {
    if (!reportData) return;
    downloadCsv(reportData.filename, reportData.columns, reportData.rows);
  };

  const handlePrintReport = () => {
    if (!reportData) return;
    printReport({
      title: reportData.title,
      subtitle: reportData.subtitle,
      summary: reportData.summary,
      columns: reportData.columns,
      rows: reportData.rows,
      footer: `Generado el ${new Date().toLocaleString('es-ES')}`,
    });
  };

  const copySellerLink = async (seller: LotterySeller) => {
    const url = `${window.location.origin}/j/${seller.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      await dialog.alert({
        title: 'Enlace copiado',
        message: url,
        variant: 'success',
      });
    } catch {
      await dialog.alert({
        title: 'Copia este enlace',
        message: (
          <input
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700"
          />
        ),
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton to="/lotteries" />
          <div className="text-center py-8">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!lottery || !data) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <BackButton to="/lotteries" />
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
        <BackButton to="/lotteries" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold text-sanse-blue">{lottery.name}</h1>
            {lottery.description && <p className="text-gray-600">{lottery.description}</p>}
            <p className="text-sm text-gray-500 mt-1">
              {lottery.num_tacos} tacos · {lottery.tickets_per_taco} papeletas/taco · números{' '}
              {pad(lottery.start_number)} - {pad(lottery.end_number ?? lottery.total_tickets)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowDelegatesModal(true)}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Delegados
            </button>
            <button
              onClick={() => {
                setReportMode('filtered');
                setShowReport(true);
              }}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Reporte
            </button>
            <button
              onClick={() => handleStatusChange(lottery.sales_status === 'open' ? 'closed' : 'open')}
              disabled={busy}
              className={`px-4 py-2 rounded-lg text-white ${lottery.sales_status === 'open' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {lottery.sales_status === 'open' ? 'Cerrar venta' : 'Abrir venta'}
            </button>
            <button
              onClick={() => navigate(`/lotteries/${lottery.id}/sales`)}
              className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Ver ventas
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">{error}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-sanse-blue">{stats.total ?? 0}</div>
            <div className="text-xs text-gray-600">Papeletas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.sold ?? 0}</div>
            <div className="text-xs text-gray-600">Vendidas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.available ?? 0}</div>
            <div className="text-xs text-gray-600">No vendidas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{money(stats.expected)}</div>
            <div className="text-xs text-gray-600">Esperado</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{money(stats.delivered)}</div>
            <div className="text-xs text-gray-600">Cobrado</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{money(stats.pending)}</div>
            <div className="text-xs text-gray-600">Pendiente</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-slate-600">{money(stats.waived)}</div>
            <div className="text-xs text-gray-600">Condonado</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{money(stats.treasuryPending)}</div>
            <div className="text-xs text-gray-600">Pendiente tesorería</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow px-4 py-3 mb-6 text-sm text-gray-600 flex flex-wrap gap-x-5 gap-y-1">
          <span>Lotería esperada: <strong>{money(statsExpectedSplit.lottery)}</strong></span>
          <span>Club esperado: <strong>{money(statsExpectedSplit.club)}</strong></span>
          <span>Lotería cobrada: <strong>{money(statsReceivedSplit.lottery)}</strong></span>
          <span>Club cobrado: <strong>{money(statsReceivedSplit.club)}</strong></span>
          <span>Entregado a tesorería: <strong>{money(stats.treasuryDelivered)}</strong></span>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold">Jugadores y conciliación</h2>
              <p className="text-sm text-gray-500">
                Esperado = ventas + donativo de papeletas no vendidas. Se permiten cobros parciales.
              </p>
            </div>
            <button
              onClick={handleAutoAssign}
              disabled={busy || unassignedBlocks.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Repartir tacos sin asignar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar jugador o equipo..."
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
            <select
              value={salesFilter}
              onChange={(event) => setSalesFilter(event.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              {SALES_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={reconFilter}
              onChange={(event) => setReconFilter(event.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              {RECON_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setSearch('');
                setTeamFilter('all');
                setSalesFilter('all');
                setReconFilter('all');
              }}
              className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
            <button
              onClick={() => setTeamFilter('all')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border ${teamFilter === 'all' ? 'bg-sanse-blue text-white border-sanse-blue' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              Todos
            </button>
            {teams.map((team) => (
              <button
                key={team}
                onClick={() => setTeamFilter(team)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border ${teamFilter === team ? 'bg-sanse-blue text-white border-sanse-blue' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {team}
              </button>
            ))}
          </div>

          <div className="mb-3">
            <span className="text-sm text-gray-500">
              {filteredSellers.length} de {sellers.length} jugadores
            </span>
          </div>

          {filteredSellers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay jugadores con esos filtros.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSellers.map((seller) => {
                const sellerBlocks = blocksByPlayer.get(seller.player_id) ?? [];
                const expectedSplit = splitExpectedSeller(seller, ticketAmounts);
                return (
                  <div key={seller.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">{seller.player_name}</h3>
                        <p className="text-xs text-gray-500">
                          {seller.team_names.length > 0 ? seller.team_names.join(' · ') : 'Sin equipo'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-1 rounded ${RECON_BADGES[seller.reconciliation_state] ?? 'bg-gray-100 text-gray-600'}`}>
                          {RECON_LABELS[seller.reconciliation_state] ?? seller.reconciliation_state}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded ${seller.sales_state === 'con_ventas' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {seller.sales_state === 'con_ventas' ? 'Con ventas' : 'Sin ventas'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center mt-4">
                      <div>
                        <div className="font-bold text-gray-700">{seller.tacos}</div>
                        <div className="text-[10px] text-gray-500">Tacos</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-600">{seller.sold}</div>
                        <div className="text-[10px] text-gray-500">Vendidas</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">{seller.available}</div>
                        <div className="text-[10px] text-gray-500">No vend.</div>
                      </div>
                      <div>
                        <div className="font-bold text-purple-600">{money(seller.expected)}</div>
                        <div className="text-[10px] text-gray-500">Esperado</div>
                      </div>
                      <div>
                        <div className="font-bold text-emerald-600">{money(seller.delivered)}</div>
                        <div className="text-[10px] text-gray-500">Cobrado</div>
                      </div>
                      <div>
                        <div className="font-bold text-red-600">{money(seller.pending_amount)}</div>
                        <div className="text-[10px] text-gray-500">Pendiente</div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-600 space-y-0.5">
                      <p>
                        Lotería: <strong>{money(expectedSplit.lottery)}</strong> · Club:{' '}
                        <strong>{money(expectedSplit.club)}</strong>
                        {seller.donation_expected > 0.005 && (
                          <span className="text-gray-500">
                            {' '}
                            (incluye {money(seller.donation_expected)} de no vendidas)
                          </span>
                        )}
                      </p>
                      {seller.waived_amount > 0 && (
                        <p className="text-slate-700">
                          Condonado: <strong>{money(seller.waived_amount)}</strong>
                          {seller.waiver_reason ? ` · ${seller.waiver_reason}` : ''}
                        </p>
                      )}
                      <p>
                        {seller.treasury_state === 'pendiente'
                          ? `Tesorería pendiente: ${money(seller.treasury_pending)}`
                          : seller.treasury_state === 'liquidado'
                            ? 'Tesorería liquidada'
                            : 'Sin cobros'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-3">
                      {sellerBlocks.map((block) => (
                        <span key={block.id} className="text-[11px] bg-gray-100 rounded px-2 py-1 font-mono">
                          {pad(block.start_number)}-{pad(block.end_number)}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <button
                        onClick={() => copySellerLink(seller)}
                        className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700"
                      >
                        Copiar enlace
                      </button>
                      <button
                        onClick={() => window.open(`/j/${seller.share_token}`, '_blank')}
                        className="bg-sanse-blue text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => openCollection(seller)}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm hover:bg-emerald-700"
                      >
                        Cobrar
                      </button>
                      <button
                        onClick={() => openWaiver(seller)}
                        className="bg-slate-600 text-white px-3 py-1.5 rounded text-sm hover:bg-slate-700"
                      >
                        Condonar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold">Tesorería</h2>
              <p className="text-sm text-gray-500">
                Marca los jugadores que ya han entregado sus cobros al tesorero. Los pagos posteriores
                volverán a aparecer como pendientes.
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="text-emerald-700">Liquidado: <strong>{money(stats.treasuryDelivered)}</strong></span>
              <span className="text-orange-700">Pendiente: <strong>{money(stats.treasuryPending)}</strong></span>
            </div>
          </div>

          {pendingTreasurySellers.length === 0 ? (
            <p className="text-gray-500 text-center py-6">No hay cobros pendientes de liquidar.</p>
          ) : (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={allTreasurySelected}
                    onChange={toggleAllTreasury}
                    className="h-4 w-4"
                  />
                  Seleccionar todos ({pendingTreasurySellers.length})
                </label>
                <span className="text-sm text-gray-600">
                  {selectedTreasurySellers.length} seleccionados · <strong>{money(selectedTreasuryTotal)}</strong>
                </span>
              </div>
              <div className="divide-y border border-gray-200 rounded-lg max-h-[420px] overflow-y-auto">
                {pendingTreasurySellers.map((seller) => (
                  <label
                    key={seller.player_id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={treasurySelected.has(seller.player_id)}
                      onChange={() => toggleTreasury(seller.player_id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{seller.player_name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {seller.team_names.join(' · ') || 'Sin equipo'} · Último cobro{' '}
                        {formatDate(seller.last_collection_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">{money(seller.treasury_pending)}</div>
                      <div className="text-[11px] text-gray-500">pendiente</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap justify-end gap-2 mt-3">
                <button
                  onClick={() => setShowDeliveryModal(true)}
                  disabled={selectedTreasurySellers.length === 0 || busy}
                  className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Generar remesa y confirmar entrega
                </button>
              </div>
            </>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-800">Remesas al tesorero</h3>
              <span className="text-sm text-gray-500">{deliveries.length} remesa(s)</span>
            </div>
            {deliveries.length === 0 ? (
              <p className="text-gray-500 text-sm">Todavía no hay remesas generadas.</p>
            ) : (
              <div className="space-y-2">
                {deliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className={`border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 ${delivery.status === 'void' ? 'bg-red-50/40 border-red-200' : 'border-gray-200'}`}
                  >
                    <div>
                      <div className="font-semibold text-gray-800">
                        {money(delivery.amount)} · {delivery.player_count ?? 0} jugador(es)
                        {delivery.status === 'void' && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Anulada</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(delivery.delivered_at)} · {delivery.notes || 'Sin notas'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setReportDeliveryId(delivery.id);
                          setReportMode('delivery');
                          setShowReport(true);
                        }}
                        className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700"
                      >
                        Ver reporte
                      </button>
                      {delivery.status === 'confirmed' && (
                        <button
                          onClick={() => handleVoidDelivery(delivery)}
                          disabled={busy}
                          className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold">Tacos sin asignar ({unassignedBlocks.length})</h2>
              <p className="text-sm text-gray-500">Asigna cada taco a un jugador o reparte todos automáticamente.</p>
            </div>
            <button
              onClick={() => openAssign(null)}
              disabled={unassignedBlocks.length === 0}
              className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              + Asignar taco
            </button>
          </div>

          {unassignedBlocks.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Todos los tacos están asignados.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {visibleUnassigned.map((block) => (
                  <div key={block.id} className="border border-gray-200 rounded-lg p-3 flex justify-between items-center gap-3">
                    <div>
                      <p className="font-mono font-bold">{pad(block.start_number)} - {pad(block.end_number)}</p>
                      <p className="text-xs text-gray-500">
                        Taco {block.block_number} · {block.available} disponibles
                      </p>
                    </div>
                    <button
                      onClick={() => openAssign(block)}
                      className="bg-sanse-blue text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                    >
                      Asignar
                    </button>
                  </div>
                ))}
              </div>
              {unassignedBlocks.length > 40 && (
                <button
                  onClick={() => setShowAllBlocks((current) => !current)}
                  className="mt-3 text-sm text-sanse-blue font-medium underline"
                >
                  {showAllBlocks ? 'Mostrar menos' : `Mostrar los ${unassignedBlocks.length} tacos`}
                </button>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-1">Tacos asignados ({blocks.length - unassignedBlocks.length})</h2>
          <p className="text-sm text-gray-500 mb-4">Puedes quitar un taco mientras no tenga papeletas vendidas.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Taco</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Números</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Jugador</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Vendidos</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Disponibles</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {blocks.filter((block) => block.player_id).map((block) => (
                  <tr key={block.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{block.block_number}</td>
                    <td className="px-3 py-2 font-mono">{pad(block.start_number)} - {pad(block.end_number)}</td>
                    <td className="px-3 py-2">{block.player_name}</td>
                    <td className="px-3 py-2 text-green-600">{block.sold}</td>
                    <td className="px-3 py-2 text-blue-600">{block.available}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openAssign(block)}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
                        >
                          Reasignar
                        </button>
                        <button
                          onClick={() => handleUnassign(block)}
                          className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                        >
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showDelegatesModal && (
          <DelegatesModal
            lotteryId={lottery.id}
            lotteryName={lottery.name}
            onClose={() => setShowDelegatesModal(false)}
          />
        )}

        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">
                {assignBlock ? `Asignar taco ${pad(assignBlock.start_number)} - ${pad(assignBlock.end_number)}` : 'Asignar taco'}
              </h3>
              <form onSubmit={handleAssign} className="space-y-4">
                {!assignBlock && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taco sin asignar</label>
                    <select
                      value=""
                      onChange={(event) => {
                        const selected = unassignedBlocks.find((block) => block.id === event.target.value) ?? null;
                        setAssignBlock(selected);
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Seleccionar taco...</option>
                      {unassignedBlocks.map((block) => (
                        <option key={block.id} value={block.id}>
                          Taco {block.block_number}: {pad(block.start_number)} - {pad(block.end_number)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jugador</label>
                  <select
                    value={assignPlayerId}
                    onChange={(event) => setAssignPlayerId(event.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleccionar jugador...</option>
                    {data.players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.full_name}{player.team_names?.length ? ` · ${player.team_names.join(', ')}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy || !assignBlock || !assignPlayerId}
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy ? 'Guardando...' : 'Asignar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAssignModal(false); setAssignBlock(null); setAssignPlayerId(''); }}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {collectionSeller && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[92vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h3 className="text-xl font-bold">Cobro de {collectionSeller.player_name}</h3>
                  <p className="text-sm text-gray-500">
                    {collectionSeller.team_names.join(' · ') || 'Sin equipo'}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${RECON_BADGES[collectionSeller.reconciliation_state] ?? 'bg-gray-100 text-gray-600'}`}>
                  {RECON_LABELS[collectionSeller.reconciliation_state] ?? collectionSeller.reconciliation_state}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center my-4">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="font-bold text-purple-700">{money(collectionSeller.expected)}</div>
                  <div className="text-[10px] text-gray-500">Esperado</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="font-bold text-slate-700">{money(collectionSeller.waived_amount)}</div>
                  <div className="text-[10px] text-gray-500">Condonado</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="font-bold text-emerald-700">{money(collectionSeller.delivered)}</div>
                  <div className="text-[10px] text-gray-500">Cobrado</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="font-bold text-red-700">{money(collectionSeller.pending_amount)}</div>
                  <div className="text-[10px] text-gray-500">Pendiente</div>
                </div>
              </div>

              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">
                <p>
                  Lotería esperada {money(collectionExpectedSplit.lottery)} · cobrada{' '}
                  {money(collectionReceivedSplit.lottery)}
                </p>
                <p>
                  Club esperado {money(collectionExpectedSplit.club)} · cobrado{' '}
                  {money(collectionReceivedSplit.club)}
                </p>
                <p>
                  Club pendiente: {money(collectionPendingClub)} · Lotería pendiente:{' '}
                  {money(collectionPendingLottery)}
                </p>
                {collectionSeller.waiver_reason && (
                  <p className="text-slate-700">Motivo de condonación: {collectionSeller.waiver_reason}</p>
                )}
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm mb-4">
                <p className="font-semibold text-emerald-800 mb-1">Cobro sugerido</p>
                <p>
                  Pendiente de ventas:{' '}
                  <strong>{formatTicketCount(collectionPendingTickets)} papeletas</strong> ·{' '}
                  {money(collectionPendingSales)}
                </p>
                <p>
                  Lotería pendiente: <strong>{money(collectionPendingLottery)}</strong> · Club
                  pendiente: <strong>{money(collectionPendingClub)}</strong>
                </p>
                <p>
                  Total pendiente: <strong>{money(collectionSuggestedSplit.total)}</strong>
                </p>
              </div>

              <form onSubmit={handleCollection} className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyCollectionShortcut('all')}
                    className={`bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-sm hover:bg-emerald-100 ${collectionMode === 'all' ? 'ring-2 ring-emerald-300' : ''}`}
                  >
                    Cobrar todo
                  </button>
                  <button
                    type="button"
                    onClick={() => applyCollectionShortcut('sales')}
                    className={`bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded text-sm hover:bg-blue-100 ${collectionMode === 'sales' ? 'ring-2 ring-blue-300' : ''}`}
                  >
                    Solo ventas
                  </button>
                  <button
                    type="button"
                    onClick={() => applyCollectionShortcut('donation')}
                    className={`bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded text-sm hover:bg-purple-100 ${collectionMode === 'donation' ? 'ring-2 ring-purple-300' : ''}`}
                  >
                    Solo donativo
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  “Cobrar todo” incluye Lotería y Club pendientes. “Solo ventas” cobra solo la
                  Lotería pendiente. “Solo donativo” cobra todo el Club pendiente, tanto de
                  papeletas vendidas como no vendidas.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Papeletas a cobrar
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max={collectionPendingTickets}
                      value={collectionTickets}
                      onChange={(event) => {
                        setCollectionTickets(event.target.value);
                        if (collectionMode === 'donation') setCollectionMode('sales');
                      }}
                      disabled={collectionMode === 'donation'}
                      className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Pendientes: {formatTicketCount(collectionPendingTickets)} papeletas ·{' '}
                      {money(collectionPendingSales)}
                    </p>
                    {collectionTicketsOver && (
                      <p className="text-xs text-red-600 mt-1">
                        Máximo {formatTicketCount(collectionPendingTickets)} papeletas.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago del cobro</label>
                    <select
                      value={collectionMethod}
                      onChange={(event) => setCollectionMethod(event.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    >
                      {LOTTERY_PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Cómo te ha pagado la jugadora</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <input
                      type="text"
                      value={collectionNotes}
                      onChange={(event) => setCollectionNotes(event.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      placeholder="Bizum, pendiente, etc."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border border-gray-200 p-2">
                    <div className="font-bold text-blue-700">{money(collectionLottery)}</div>
                    <div className="text-[10px] text-gray-500">Lotería</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-2">
                    <div className="font-bold text-purple-700">{money(collectionClub)}</div>
                    <div className="text-[10px] text-gray-500">Club</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-2">
                    <div className="font-bold text-emerald-700">{money(collectionTotal)}</div>
                    <div className="text-[10px] text-gray-500">Total a registrar</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-2">
                    <div className="font-bold text-red-700">{money(collectionRemaining)}</div>
                    <div className="text-[10px] text-gray-500">Queda pendiente</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Reparto del cobro: Lotería {money(collectionLottery)} · Club{' '}
                  {money(collectionClub)}.
                </p>
                {collectionOver > 0.005 && (
                  <p className="text-sm text-purple-700">
                    Entrega de más: <strong>{money(collectionOver)}</strong>
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy || collectionTotal <= 0}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? 'Guardando...' : 'Guardar cobro'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionSeller(null)}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cerrar
                  </button>
                </div>
              </form>

              <div className="mt-5">
                <h4 className="font-semibold text-gray-800 mb-2">Historial de cobros</h4>
                {collectionSettlements.length === 0 ? (
                  <p className="text-sm text-gray-500">Todavía no hay cobros registrados.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {collectionSettlements.map((settlement) => {
                      const settlementSplit = splitSettlementReceived(
                        settlement,
                        ticketAmounts,
                      );
                      return (
                        <div
                          key={settlement.id}
                          className={`border rounded-lg p-3 text-sm ${settlement.status === 'void' ? 'bg-red-50/40 border-red-200 text-gray-500' : 'border-gray-200'}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-medium">
                                {money(settlement.delivered_amount)}
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  {formatDate(settlement.created_at)}
                                </span>
                                {settlement.status === 'void' && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Anulado</span>
                                )}
                                {settlement.created_via === 'delegate' && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                    Delegado
                                    {settlement.delegate_team_name ? ` · ${settlement.delegate_team_name}` : ''}
                                  </span>
                                )}
                                {settlement.treasurer_delivery_id && settlement.status !== 'void' && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-700">En remesa</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                Lotería {money(settlementSplit.lottery)} · Club{' '}
                                {money(settlementSplit.club)}
                                {settlement.payment_method ? ` · Cobro: ${settlement.payment_method}` : ''}
                                {settlement.notes ? ` · ${settlement.notes}` : ''}
                              </div>
                              {settlement.status === 'void' && settlement.void_reason && (
                                <div className="text-xs text-red-600 mt-1">Motivo: {settlement.void_reason}</div>
                              )}
                            </div>
                            {settlement.status !== 'void' && !settlement.treasurer_delivery_id && (
                              <button
                                type="button"
                                onClick={() => handleVoidCollection(settlement)}
                                disabled={busy}
                                className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                              >
                                Anular
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {waiverSeller && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-1">Condonar a {waiverSeller.player_name}</h3>
              <p className="text-sm text-gray-500 mb-4">
                La condonación reduce el importe exigible y no cuenta como dinero cobrado.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 text-sm mb-4 space-y-1">
                <p>Esperado: <strong>{money(waiverSeller.expected)}</strong></p>
                <p>Cobrado: <strong>{money(waiverSeller.delivered)}</strong></p>
                <p>Máximo condonable ahora: <strong>{money(waiverMax)}</strong></p>
                {waiverSeller.waived_amount > 0 && (
                  <p className="text-slate-700">Condonado actual: <strong>{money(waiverSeller.waived_amount)}</strong></p>
                )}
              </div>
              <form onSubmit={handleWaiver} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Importe condonado (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={waiverMax}
                    value={waiverAmount}
                    onChange={(event) => setWaiverAmount(event.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                  <textarea
                    value={waiverReason}
                    onChange={(event) => setWaiverReason(event.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    rows={2}
                    placeholder="Jugador exento, acuerdo del club..."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? 'Guardando...' : 'Guardar condonación'}
                  </button>
                  {waiverSeller.waived_amount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearWaiver}
                      disabled={busy}
                      className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setWaiverSeller(null)}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeliveryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full">
              <h3 className="text-xl font-bold mb-1">Confirmar entrega al tesorero</h3>
              <p className="text-sm text-gray-500 mb-4">
                Se marcarán todos los cobros pendientes de los jugadores seleccionados.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                <p className="font-semibold">{selectedTreasurySellers.length} jugador(es) seleccionados</p>
                <p className="text-2xl font-bold text-sanse-blue mt-1">{money(selectedTreasuryTotal)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {selectedTreasurySellers.slice(0, 8).map((seller) => seller.player_name).join(', ')}
                  {selectedTreasurySellers.length > 8 ? ` y ${selectedTreasurySellers.length - 8} más` : ''}
                </p>
              </div>
              <form onSubmit={handleCreateDelivery} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas de la remesa</label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(event) => setDeliveryNotes(event.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    rows={2}
                    placeholder="Entregado en mano, transferencia..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy ? 'Guardando...' : 'Confirmar entrega'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeliveryModal(false)}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showReport && reportData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-6xl w-full max-h-[92vh] overflow-y-auto">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-bold">{reportData.title}</h3>
                  <p className="text-sm text-gray-500">{reportData.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleDownloadReport} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">
                    CSV
                  </button>
                  <button onClick={handlePrintReport} className="bg-sanse-blue text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
                    Imprimir / PDF
                  </button>
                  <button onClick={() => setShowReport(false)} className="bg-gray-500 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-600">
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setReportMode('filtered')}
                  className={`px-3 py-1.5 rounded text-sm border ${reportMode === 'filtered' ? 'bg-sanse-blue text-white border-sanse-blue' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  Conciliación filtrada
                </button>
                <button
                  onClick={() => setReportMode('consolidated')}
                  className={`px-3 py-1.5 rounded text-sm border ${reportMode === 'consolidated' ? 'bg-sanse-blue text-white border-sanse-blue' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  Consolidado tesorería
                </button>
                {deliveries.length > 0 && (
                  <button
                    onClick={() => {
                      if (!reportDeliveryId) setReportDeliveryId(deliveries[0].id);
                      setReportMode('delivery');
                    }}
                    className={`px-3 py-1.5 rounded text-sm border ${reportMode === 'delivery' ? 'bg-sanse-blue text-white border-sanse-blue' : 'bg-white text-gray-600 border-gray-300'}`}
                  >
                    Remesa
                  </button>
                )}
                {reportMode === 'delivery' && deliveries.length > 0 && (
                  <select
                    value={reportDeliveryId}
                    onChange={(event) => setReportDeliveryId(event.target.value)}
                    className="px-3 py-1.5 rounded text-sm border border-gray-300 bg-white"
                  >
                    {deliveries.map((delivery) => (
                      <option key={delivery.id} value={delivery.id}>
                        {formatDate(delivery.delivered_at)} · {money(delivery.amount)}
                        {delivery.status === 'void' ? ' · Anulada' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mb-4">
                {reportData.summary.map((item) => (
                  <div key={item.label} className="border border-gray-200 rounded-lg p-2">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">{item.label}</div>
                    <div className="font-bold text-gray-800">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {reportData.columns.map((column) => (
                        <th key={column} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={reportData.columns.length} className="px-3 py-6 text-center text-gray-500">
                          No hay datos para este reporte.
                        </td>
                      </tr>
                    ) : (
                      reportData.rows.map((row, index) => (
                        <tr key={`${reportMode}-${index}`} className="border-t">
                          {row.map((cell, cellIndex) => (
                            <td key={`${index}-${cellIndex}`} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LotteryDetail;
