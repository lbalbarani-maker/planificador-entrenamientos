const {
  adminClient,
  readJson,
  requireAdmin,
  sendJson,
} = require('../_lib/lotteryAdmin');

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cents(value) {
  return Math.round(number(value) * 100);
}

function safeError(res, error) {
  console.error('[lottery/admin]', error);
  sendJson(res, 400, {
    error: error?.message || 'No se pudo completar la operación',
  });
}

function sum(list, selector) {
  return list.reduce((total, item) => total + number(selector(item)), 0);
}

function isActiveSettlement(settlement) {
  return settlement.status !== 'void';
}

function settlementSales(settlement) {
  return settlement.sales_received != null
    ? number(settlement.sales_received)
    : number(settlement.delivered_amount);
}

function settlementDonation(settlement) {
  return settlement.donation_received != null
    ? number(settlement.donation_received)
    : 0;
}

function hasSplit(settlement) {
  return (
    number(settlement.lottery_received) > 0 ||
    number(settlement.club_received) > 0
  );
}

function settlementLottery(settlement) {
  if (hasSplit(settlement)) return number(settlement.lottery_received);

  const sales = settlementSales(settlement);
  const price = number(settlement.ticket_price);
  const donation = number(settlement.donation_per_ticket);
  if (price <= 0) return 0;

  return Math.round((sales * (price - donation)) / price * 100) / 100;
}

function settlementClub(settlement) {
  if (hasSplit(settlement)) return number(settlement.club_received);

  return Math.max(number(settlement.delivered_amount) - settlementLottery(settlement), 0);
}

function reconciliationState(expected, waived, delivered, due) {
  if (cents(expected) <= 0) {
    return cents(delivered) > 0 ? 'de_mas' : 'sin_obligacion';
  }
  if (cents(waived) >= cents(expected) && cents(delivered) <= 0) {
    return 'exento';
  }
  if (cents(delivered) <= 0) {
    return 'pendiente';
  }
  if (cents(delivered) < cents(due)) {
    return 'parcial';
  }
  if (cents(delivered) === cents(due)) {
    return 'entregado';
  }
  return 'de_mas';
}

async function fetchAllRows(build, pageSize = 1000) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function listLotteries(client) {
  const [lotteries, tickets, purchases] = await Promise.all([
    fetchAllRows(() =>
      client
        .from('lotteries')
        .select('*, club:clubs(id,name)')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }),
    ),
    fetchAllRows(() =>
      client
        .from('tickets')
        .select('lottery_id')
        .eq('status', 'sold')
        .order('id', { ascending: true }),
    ),
    fetchAllRows(() =>
      client
        .from('ticket_purchases')
        .select('lottery_id,quantity,total_amount,donation_amount,status')
        .order('id', { ascending: true }),
    ),
  ]);

  const confirmedPurchases = purchases.filter((purchase) => purchase.status === 'confirmed');

  return lotteries.map((lottery) => {
    const sold = tickets.filter((ticket) => ticket.lottery_id === lottery.id).length;
    const total = number(lottery.total_tickets);
    const lotteryPurchases = confirmedPurchases.filter((purchase) => purchase.lottery_id === lottery.id);
    const donation = total * number(lottery.donation_per_ticket);
    return {
      ...lottery,
      stats: {
        total,
        sold,
        available: Math.max(total - sold, 0),
        revenue: sum(lotteryPurchases, (purchase) => purchase.total_amount),
        expected: sum(lotteryPurchases, (purchase) => purchase.total_amount) + donation - sold * number(lottery.donation_per_ticket),
        delivered: 0,
        difference: 0,
        donation,
        purchases: lotteryPurchases.length,
      },
    };
  });
}

async function getLottery(client, lotteryId) {
  const lotteryResult = await client
    .from('lotteries')
    .select('*, club:clubs(*)')
    .eq('id', lotteryId)
    .maybeSingle();

  if (lotteryResult.error) throw lotteryResult.error;
  const lottery = lotteryResult.data;
  if (!lottery) throw new Error('Lotería no encontrada');

  const [blocks, sellers, purchases, settlements, deliveries, tickets, players] = await Promise.all([
    fetchAllRows(() =>
      client
        .from('ticket_blocks')
        .select('*, player:players(id,full_name)')
        .eq('lottery_id', lotteryId)
        .order('block_number', { ascending: true })
        .order('id', { ascending: true }),
    ),
    fetchAllRows(() =>
      client
        .from('lottery_sellers')
        .select('*, player:players(id,full_name)')
        .eq('lottery_id', lotteryId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
    ),
    fetchAllRows(() =>
      client
        .from('ticket_purchases')
        .select('*')
        .eq('lottery_id', lotteryId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }),
    ),
    fetchAllRows(() =>
      client
        .from('lottery_settlements')
        .select('*')
        .eq('lottery_id', lotteryId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
    ),
    fetchAllRows(() =>
      client
        .from('lottery_treasurer_deliveries')
        .select('*')
        .eq('lottery_id', lotteryId)
        .order('delivered_at', { ascending: false })
        .order('id', { ascending: true }),
    ),
    fetchAllRows(() =>
      client
        .from('tickets')
        .select('ticket_block_id,purchase_id,number,status')
        .eq('lottery_id', lotteryId)
        .eq('status', 'sold')
        .order('id', { ascending: true }),
    ),
    fetchAllRows(() =>
      client
        .from('players')
        .select('id,full_name,birth_date,is_active,club_id')
        .eq('club_id', lottery.club_id)
        .eq('is_active', true)
        .order('full_name')
        .order('id', { ascending: true }),
    ),
  ]);

  const playerIds = players.map((player) => player.id);
  let teamRows = [];
  if (playerIds.length > 0) {
    teamRows = await fetchAllRows(() =>
      client
        .from('team_players')
        .select('player_id,is_active,team:teams(id,name,category)')
        .in('player_id', playerIds)
        .eq('is_active', true)
        .order('id', { ascending: true }),
    );
  }

  const teamsByPlayer = new Map();
  for (const row of teamRows) {
    if (!row.team) continue;
    const current = teamsByPlayer.get(row.player_id) ?? [];
    current.push(row.team);
    teamsByPlayer.set(row.player_id, current);
  }

  const ticketsByBlock = new Map();
  for (const ticket of tickets) {
    if (ticket.ticket_block_id) {
      const current = ticketsByBlock.get(ticket.ticket_block_id) ?? [];
      current.push(ticket);
      ticketsByBlock.set(ticket.ticket_block_id, current);
    }
  }

  const ticketsByPurchase = new Map();
  for (const ticket of tickets) {
    if (ticket.purchase_id) {
      const current = ticketsByPurchase.get(ticket.purchase_id) ?? [];
      current.push(ticket.number);
      ticketsByPurchase.set(ticket.purchase_id, current);
    }
  }

  const playerName = new Map([
    ...sellers.map((seller) => [seller.player_id, seller.player?.full_name]),
    ...players.map((player) => [player.id, player.full_name]),
  ]);

  const blocksWithStats = blocks.map((block) => {
    const blockTickets = ticketsByBlock.get(block.id) ?? [];
    const total = Math.max(0, number(block.end_number) - number(block.start_number) + 1);
    const sold = blockTickets.length;
    return {
      ...block,
      total,
      sold,
      available: Math.max(total - sold, 0),
    };
  });

  const blocksByPlayer = new Map();
  for (const block of blocksWithStats) {
    if (!block.player_id) continue;
    const current = blocksByPlayer.get(block.player_id) ?? [];
    current.push(block);
    blocksByPlayer.set(block.player_id, current);
  }

  const purchasesBySeller = new Map();
  for (const purchase of purchases) {
    if (purchase.status !== 'confirmed') continue;
    const current = purchasesBySeller.get(purchase.seller_id) ?? [];
    current.push(purchase);
    purchasesBySeller.set(purchase.seller_id, current);
  }

  const settlementsByPlayer = new Map();
  for (const settlement of settlements) {
    const current = settlementsByPlayer.get(settlement.player_id) ?? [];
    current.push(settlement);
    settlementsByPlayer.set(settlement.player_id, current);
  }

  const ticketPrice = number(lottery.ticket_price);
  const donationPerTicket = number(lottery.donation_per_ticket);
  const confirmedDeliveryIds = new Set(
    deliveries
      .filter((delivery) => delivery.status === 'confirmed')
      .map((delivery) => delivery.id),
  );

  const sellerCards = sellers.map((seller) => {
    const sellerBlocks = blocksByPlayer.get(seller.player_id) ?? [];
    const sold = sum(sellerBlocks, (block) => block.sold);
    const total = sum(sellerBlocks, (block) => block.total);
    const unsold = Math.max(total - sold, 0);
    const lotteryPerTicket = Math.max(ticketPrice - donationPerTicket, 0);
    const salesExpected = sold * ticketPrice;
    const lotteryExpected = sold * lotteryPerTicket;
    const donationExpected = unsold * donationPerTicket;
    const clubExpected = total * donationPerTicket;
    const expected = salesExpected + donationExpected;
    const sellerSettlements = settlementsByPlayer.get(seller.player_id) ?? [];
    const activeSettlements = sellerSettlements.filter(isActiveSettlement);
    const lotteryReceived = sum(activeSettlements, settlementLottery);
    const clubReceived = sum(activeSettlements, settlementClub);
    const delivered = sum(activeSettlements, (settlement) => settlement.delivered_amount);
    const waived = number(seller.waived_amount);
    const due = Math.max(expected - waived, 0);
    const pending = Math.max(due - delivered, 0);
    const pendingLottery = Math.max(lotteryExpected - lotteryReceived, 0);
    const pendingClub = Math.max(clubExpected - clubReceived, 0);
    const treasuryDelivered = sum(
      activeSettlements.filter(
        (settlement) =>
          settlement.treasurer_delivery_id &&
          confirmedDeliveryIds.has(settlement.treasurer_delivery_id),
      ),
      (settlement) => settlement.delivered_amount,
    );
    const treasuryPending = sum(
      activeSettlements.filter(
        (settlement) =>
          !settlement.treasurer_delivery_id ||
          !confirmedDeliveryIds.has(settlement.treasurer_delivery_id),
      ),
      (settlement) => settlement.delivered_amount,
    );
    const lastCollection = activeSettlements.at(-1)?.created_at ?? null;

    return {
      ...seller,
      player_name: seller.player?.full_name ?? playerName.get(seller.player_id) ?? 'Jugador',
      team_names: (teamsByPlayer.get(seller.player_id) ?? []).map((team) => team.name),
      tacos: sellerBlocks.length,
      total,
      sold,
      available: unsold,
      tickets_assigned: total,
      tickets_unsold: unsold,
      revenue: salesExpected,
      donation: total * donationPerTicket,
      sales_expected: salesExpected,
      donation_expected: donationExpected,
      lottery_expected: lotteryExpected,
      club_expected: clubExpected,
      expected,
      sales_received: lotteryReceived,
      donation_received: clubReceived,
      lottery_received: lotteryReceived,
      club_received: clubReceived,
      delivered,
      waived_amount: waived,
      due_amount: due,
      pending_amount: pending,
      pending_lottery: pendingLottery,
      pending_club: pendingClub,
      pending_tickets: lotteryPerTicket > 0 ? Math.ceil(pendingLottery / lotteryPerTicket) : 0,
      difference: delivered - due,
      treasury_delivered: treasuryDelivered,
      treasury_pending: treasuryPending,
      sales_state: sold > 0 ? 'con_ventas' : 'sin_ventas',
      reconciliation_state: reconciliationState(expected, waived, delivered, due),
      treasury_state: treasuryPending > 0 ? 'pendiente' : delivered > 0 ? 'liquidado' : 'sin_cobros',
      last_collection_at: lastCollection,
      last_settlement_at: lastCollection,
    };
  });

  for (const block of blocksWithStats) {
    block.player_name = block.player?.full_name ?? playerName.get(block.player_id) ?? null;
    block.team_names = block.player_id
      ? (teamsByPlayer.get(block.player_id) ?? []).map((team) => team.name)
      : [];
    const seller = sellers.find((row) => row.player_id === block.player_id);
    block.share_token = seller?.share_token ?? null;
  }

  const collectionStatusByPlayer = new Map(
    sellerCards.map((seller) => {
      if (seller.delivered <= 0) return [seller.player_id, 'confirmed'];
      return [
        seller.player_id,
        seller.pending_amount <= 0 ? 'collected' : 'partial',
      ];
    }),
  );

  const purchasesWithData = purchases.map((purchase) => {
    const storedNumbers = Array.isArray(purchase.ticket_numbers)
      ? purchase.ticket_numbers
      : [];
    const ticketNumbers =
      storedNumbers.length > 0
        ? storedNumbers
        : (ticketsByPurchase.get(purchase.id) ?? []).sort((a, b) => a - b);

    return {
      ...purchase,
      seller_name: playerName.get(purchase.seller_id) ?? 'Jugador',
      ticket_numbers: ticketNumbers,
      collection_status:
        purchase.status === 'void'
          ? 'void'
          : collectionStatusByPlayer.get(purchase.seller_id) ?? 'confirmed',
    };
  });

  const deliveryById = new Map(deliveries.map((delivery) => [delivery.id, delivery]));

  const settlementsWithNames = settlements.map((settlement) => ({
    ...settlement,
    player_name: playerName.get(settlement.player_id) ?? 'Jugador',
    treasurer_delivered_at:
      settlement.treasurer_delivery_id &&
      deliveryById.get(settlement.treasurer_delivery_id)?.status === 'confirmed'
        ? deliveryById.get(settlement.treasurer_delivery_id)?.delivered_at ?? null
        : null,
  }));

  const deliveriesWithData = deliveries.map((delivery) => {
    const deliverySettlements = settlements.filter(
      (settlement) =>
        settlement.treasurer_delivery_id === delivery.id &&
        settlement.status === 'confirmed',
    );
    const snapshot =
      delivery.snapshot && typeof delivery.snapshot === 'object'
        ? delivery.snapshot
        : {};
    const snapshotSettlements = Array.isArray(snapshot.settlements)
      ? snapshot.settlements
      : [];
    const snapshotPlayerIds = Array.isArray(snapshot.player_ids)
      ? snapshot.player_ids
      : [];
    const deliveryPlayerIds = Array.from(
      new Set([
        ...deliverySettlements.map((settlement) => settlement.player_id),
        ...snapshotPlayerIds,
        ...snapshotSettlements
          .map((settlement) => settlement?.player_id)
          .filter(Boolean),
      ]),
    );
    return {
      ...delivery,
      player_names: deliveryPlayerIds.map((playerId) => playerName.get(playerId) ?? 'Jugador'),
      player_count:
        number(snapshot.player_count) ||
        deliveryPlayerIds.length ||
        deliverySettlements.length,
      settlement_count:
        number(snapshot.settlement_count) ||
        deliverySettlements.length ||
        snapshotSettlements.length,
    };
  });

  const activeSettlements = settlements.filter(isActiveSettlement);
  const total = number(lottery.total_tickets);
  const soldTickets = tickets.filter((ticket) => ticket.status === 'sold');
  const salesExpected = sum(sellerCards, (seller) => seller.sales_expected);
  const donationExpected = sum(sellerCards, (seller) => seller.donation_expected);
  const lotteryExpected = sum(sellerCards, (seller) => seller.lottery_expected);
  const clubExpected = sum(sellerCards, (seller) => seller.club_expected);
  const lotteryReceived = sum(activeSettlements, settlementLottery);
  const clubReceived = sum(activeSettlements, settlementClub);
  const expected = salesExpected + donationExpected;
  const waived = sum(sellerCards, (seller) => seller.waived_amount);
  const due = Math.max(expected - waived, 0);
  const delivered = sum(activeSettlements, (settlement) => settlement.delivered_amount);
  const pending = Math.max(due - delivered, 0);
  const pendingLottery = Math.max(lotteryExpected - lotteryReceived, 0);
  const pendingClub = Math.max(clubExpected - clubReceived, 0);
  const treasuryDelivered = sum(
    activeSettlements.filter(
      (settlement) =>
        settlement.treasurer_delivery_id &&
        confirmedDeliveryIds.has(settlement.treasurer_delivery_id),
    ),
    (settlement) => settlement.delivered_amount,
  );
  const treasuryPending = sum(
    activeSettlements.filter(
      (settlement) =>
        !settlement.treasurer_delivery_id ||
        !confirmedDeliveryIds.has(settlement.treasurer_delivery_id),
    ),
    (settlement) => settlement.delivered_amount,
  );
  const confirmedPurchases = purchases.filter((purchase) => purchase.status === 'confirmed');

  return {
    lottery: {
      ...lottery,
      stats: {
        total,
        sold: soldTickets.length,
        available: Math.max(total - soldTickets.length, 0),
        revenue: salesExpected,
        salesExpected,
        donationExpected,
        lotteryExpected,
        clubExpected,
        expected,
        delivered,
        difference: delivered - due,
        pending,
        pendingLottery,
        pendingClub,
        due,
        waived,
        donation: total * donationPerTicket,
        salesReceived: lotteryReceived,
        donationReceived: clubReceived,
        lotteryReceived,
        clubReceived,
        treasuryDelivered,
        treasuryPending,
        purchases: confirmedPurchases.length,
        deliveries: deliveries.filter((delivery) => delivery.status !== 'void').length,
      },
    },
    players: players.map((player) => ({
      ...player,
      team_names: (teamsByPlayer.get(player.id) ?? []).map((team) => team.name),
    })),
    sellers: sellerCards,
    blocks: blocksWithStats,
    purchases: purchasesWithData,
    settlements: settlementsWithNames,
    deliveries: deliveriesWithData,
  };
}

async function handleAction(client, admin, body) {
  const action = String(body.action ?? '');

  if (action === 'list') {
    return { lotteries: await listLotteries(client) };
  }

  if (action === 'get') {
    return getLottery(client, body.lotteryId);
  }

  if (action === 'create') {
    const { data, error } = await client.rpc('admin_create_lottery', {
      p_club_id: body.clubId,
      p_name: body.name,
      p_description: body.description ?? '',
      p_draw_date: body.drawDate || null,
      p_lottery_number_1: body.lotteryNumber1 ?? '',
      p_lottery_number_2: body.lotteryNumber2 ?? '',
      p_ticket_price: number(body.ticketPrice),
      p_donation_per_ticket: number(body.donationPerTicket),
      p_num_tacos: number(body.numTacos),
      p_tickets_per_taco: number(body.ticketsPerTaco),
      p_start_number: number(body.startNumber),
      p_auto_assign: Boolean(body.autoAssign),
      p_team_id: body.teamId || null,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'update') {
    const { data, error } = await client.rpc('admin_update_lottery', {
      p_lottery_id: body.lotteryId,
      p_name: body.name,
      p_description: body.description ?? '',
      p_draw_date: body.drawDate || null,
      p_lottery_number_1: body.lotteryNumber1 ?? '',
      p_lottery_number_2: body.lotteryNumber2 ?? '',
      p_sales_status: body.salesStatus || null,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'delete') {
    const { error } = await client.from('lotteries').delete().eq('id', body.lotteryId);
    if (error) throw error;
    return { ok: true };
  }

  if (action === 'assign') {
    const { data, error } = await client.rpc('admin_assign_taco', {
      p_block_id: body.blockId,
      p_player_id: body.playerId || null,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'auto-assign') {
    const { data, error } = await client.rpc('admin_auto_assign', {
      p_lottery_id: body.lotteryId,
      p_team_id: body.teamId || null,
      p_club_id: body.clubId || null,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'annul-sale') {
    const { data, error } = await client.rpc('admin_annul_sale', {
      p_purchase_id: body.purchaseId,
      p_admin_id: admin.sub,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'register-collection') {
    const usesSplit =
      body.lotteryReceived != null || body.clubReceived != null;
    const { data, error } = usesSplit
      ? await client.rpc('admin_register_collection_split', {
          p_lottery_id: body.lotteryId,
          p_player_id: body.playerId,
          p_lottery_received: number(body.lotteryReceived),
          p_club_received: number(body.clubReceived),
          p_payment_method: body.paymentMethod || null,
          p_notes: body.notes || null,
          p_admin_id: admin.sub,
        })
      : await client.rpc('admin_register_collection', {
          p_lottery_id: body.lotteryId,
          p_player_id: body.playerId,
          p_sales_received: number(body.salesReceived),
          p_donation_received: number(body.donationReceived),
          p_payment_method: body.paymentMethod || null,
          p_notes: body.notes || null,
          p_admin_id: admin.sub,
        });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'settle-player') {
    const { data, error } = await client.rpc('admin_register_collection', {
      p_lottery_id: body.lotteryId,
      p_player_id: body.playerId,
      p_sales_received: number(body.amount),
      p_donation_received: 0,
      p_payment_method: null,
      p_notes: body.notes || null,
      p_admin_id: admin.sub,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'void-collection') {
    const { data, error } = await client.rpc('admin_void_collection', {
      p_settlement_id: body.settlementId,
      p_admin_id: admin.sub,
      p_reason: body.reason || null,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'set-waiver') {
    const { data, error } = await client.rpc('admin_set_waiver', {
      p_lottery_id: body.lotteryId,
      p_player_id: body.playerId,
      p_amount: number(body.amount),
      p_reason: body.reason || null,
      p_admin_id: admin.sub,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'void-waiver') {
    const { data, error } = await client.rpc('admin_void_waiver', {
      p_lottery_id: body.lotteryId,
      p_player_id: body.playerId,
      p_admin_id: admin.sub,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'create-treasurer-delivery') {
    const playerIds = Array.isArray(body.playerIds)
      ? body.playerIds.filter((playerId) => typeof playerId === 'string' && playerId)
      : [];
    const { data, error } = await client.rpc('admin_create_treasurer_delivery', {
      p_lottery_id: body.lotteryId,
      p_player_ids: playerIds,
      p_notes: body.notes || null,
      p_admin_id: admin.sub,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'void-treasurer-delivery') {
    const { data, error } = await client.rpc('admin_void_treasurer_delivery', {
      p_delivery_id: body.deliveryId,
      p_admin_id: admin.sub,
      p_reason: body.reason || null,
    });
    if (error) throw error;
    return { result: data };
  }

  if (action === 'set-status') {
    const allowed = ['open', 'closed', 'drawn', 'settled'];
    if (!allowed.includes(body.salesStatus)) throw new Error('Estado no válido');
    const { error } = await client
      .from('lotteries')
      .update({ sales_status: body.salesStatus, updated_at: new Date().toISOString() })
      .eq('id', body.lotteryId);
    if (error) throw error;
    return { ok: true };
  }

  throw new Error('Acción no reconocida');
}

module.exports = async function handler(request, res) {
  if (request.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Método no permitido' });
    return;
  }

  const admin = await requireAdmin(request, res);
  if (!admin) return;

  try {
    const client = adminClient();
    const body = await readJson(request);
    const result = await handleAction(client, admin, body);
    sendJson(res, 200, result);
  } catch (error) {
    safeError(res, error);
  }
};
