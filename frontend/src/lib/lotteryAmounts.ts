export interface LotteryAmountConfig {
  ticketPrice: number;
  donationPerTicket: number;
}

export interface MoneySplit {
  total: number;
  lottery: number;
  club: number;
}

interface SellerTicketCounts {
  sold: number;
  tickets_assigned?: number;
  total?: number;
}

interface SellerCollectionState extends SellerTicketCounts {
  pending_amount?: number;
  lottery_expected?: number;
  club_expected?: number;
  lottery_received?: number;
  club_received?: number;
  sales_received?: number;
  donation_received?: number;
}

interface SettlementCollectionState {
  delivered_amount?: number;
  total_received?: number;
  total_expected?: number;
  lottery_received?: number;
  club_received?: number;
  sales_received?: number;
  donation_received?: number;
  ticket_price?: number;
  donation_per_ticket?: number;
}

export interface PendingCollectionSplit extends MoneySplit {
  tickets: number;
  sales: number;
  unsoldDonation: number;
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function getTicketAmounts(config: LotteryAmountConfig) {
  const ticketPrice = Math.max(Number(config.ticketPrice) || 0, 0);
  const donationPerTicket = Math.min(
    Math.max(Number(config.donationPerTicket) || 0, 0),
    ticketPrice,
  );

  return {
    ticketPrice,
    donationPerTicket,
    lotteryPerTicket: roundMoney(ticketPrice - donationPerTicket),
  };
}

export function splitExpectedSeller(
  seller: SellerTicketCounts,
  config: LotteryAmountConfig,
): MoneySplit {
  const amounts = getTicketAmounts(config);
  const sold = Math.max(Number(seller.sold) || 0, 0);
  const assigned = Math.max(
    Number(seller.tickets_assigned ?? seller.total) || 0,
    0,
  );
  const lottery = roundMoney(sold * amounts.lotteryPerTicket);
  const club = roundMoney(assigned * amounts.donationPerTicket);

  return {
    lottery,
    club,
    total: roundMoney(lottery + club),
  };
}

export function splitReceivedSeller(
  seller: SellerCollectionState,
  config: LotteryAmountConfig,
): MoneySplit {
  const expected = splitExpectedSeller(seller, config);
  const hasSplit =
    seller.lottery_received != null || seller.club_received != null;

  if (hasSplit) {
    const lottery = roundMoney(Math.max(Number(seller.lottery_received) || 0, 0));
    const club = roundMoney(Math.max(Number(seller.club_received) || 0, 0));
    return { lottery, club, total: roundMoney(lottery + club) };
  }

  return splitCollectionAmounts(
    Number(seller.sales_received) || 0,
    Number(seller.donation_received) || 0,
    config,
    expected.lottery,
  );
}

export function splitSettlementReceived(
  settlement: SettlementCollectionState,
  config: LotteryAmountConfig,
): MoneySplit {
  const delivered = roundMoney(
    settlement.delivered_amount ??
      settlement.total_received ??
      (Number(settlement.sales_received) || 0) +
        (Number(settlement.donation_received) || 0),
  );
  const hasSplit =
    (Number(settlement.lottery_received) || 0) > 0 ||
    (Number(settlement.club_received) || 0) > 0;

  if (hasSplit) {
    const lottery = roundMoney(Math.max(Number(settlement.lottery_received) || 0, 0));
    const club = roundMoney(Math.max(Number(settlement.club_received) || 0, 0));
    return { lottery, club, total: roundMoney(lottery + club) };
  }

  const legacyConfig: LotteryAmountConfig = {
    ticketPrice: settlement.ticket_price ?? config.ticketPrice,
    donationPerTicket:
      settlement.donation_per_ticket ?? config.donationPerTicket,
  };
  const sales = Number(settlement.sales_received) || 0;
  const expectedLottery =
    legacyConfig.ticketPrice > 0
      ? roundMoney(
          (sales *
            Math.max(
              legacyConfig.ticketPrice - legacyConfig.donationPerTicket,
              0,
            )) /
            legacyConfig.ticketPrice,
        )
      : 0;
  const split = splitCollectionAmounts(
    sales,
    Number(settlement.donation_received) || 0,
    legacyConfig,
    expectedLottery,
  );

  return {
    lottery: split.lottery,
    club: roundMoney(Math.max(delivered - split.lottery, 0)),
    total: delivered,
  };
}

export function splitPendingSeller(
  seller: SellerCollectionState,
  config: LotteryAmountConfig,
): PendingCollectionSplit {
  const amounts = getTicketAmounts(config);
  const expected = splitExpectedSeller(seller, config);
  const received = splitReceivedSeller(seller, config);
  const rawLottery = roundMoney(Math.max(expected.lottery - received.lottery, 0));
  const rawClub = roundMoney(Math.max(expected.club - received.club, 0));
  const rawTotal = roundMoney(rawLottery + rawClub);
  const pending = roundMoney(
    Math.min(
      Math.max(
        seller.pending_amount === undefined
          ? rawTotal
          : Number(seller.pending_amount) || 0,
        0,
      ),
      rawTotal,
    ),
  );
  const lottery = roundMoney(Math.min(rawLottery, pending));
  const club = roundMoney(Math.max(pending - lottery, 0));
  const tickets =
    amounts.lotteryPerTicket > 0 ? lottery / amounts.lotteryPerTicket : 0;
  const sales = roundMoney(tickets * amounts.ticketPrice);
  const unsoldDonation = roundMoney(
    Math.max(club - tickets * amounts.donationPerTicket, 0),
  );

  return { total: pending, lottery, club, tickets, sales, unsoldDonation };
}

export function splitCollectionAmounts(
  salesReceived: number,
  donationReceived: number,
  config: LotteryAmountConfig,
  expectedLottery?: number,
): MoneySplit {
  const amounts = getTicketAmounts(config);
  const sales = Math.max(Number(salesReceived) || 0, 0);
  const donation = Math.max(Number(donationReceived) || 0, 0);
  const total = roundMoney(sales + donation);

  if (amounts.ticketPrice <= 0) {
    return { total, lottery: total, club: 0 };
  }

  const ticketsPaid = sales / amounts.ticketPrice;
  const clubFromSales = ticketsPaid * amounts.donationPerTicket;
  const salesAlreadySplit =
    expectedLottery !== undefined &&
    sales <= expectedLottery + 0.005 &&
    donation + 0.005 >= clubFromSales;

  const rawLottery = salesAlreadySplit
    ? sales
    : ticketsPaid * amounts.lotteryPerTicket;
  const lottery = roundMoney(Math.min(Math.max(rawLottery, 0), total));

  return {
    total,
    lottery,
    club: roundMoney(total - lottery),
  };
}

export function formatTicketCount(value: number): string {
  const safe = roundMoney(Number(value) || 0);
  return Number.isInteger(safe)
    ? String(safe)
    : safe.toFixed(2).replace(/\.?0+$/, '');
}
