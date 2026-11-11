import { Club, Player } from './teams';

export type { Club, Player };

export type LotterySalesStatus = 'open' | 'closed' | 'drawn' | 'settled';

export type LotteryReconciliationState =
  | 'pendiente'
  | 'parcial'
  | 'entregado'
  | 'de_mas'
  | 'exento'
  | 'sin_obligacion';

export type LotterySalesState = 'sin_ventas' | 'con_ventas';
export type LotteryTreasuryState = 'sin_cobros' | 'pendiente' | 'liquidado';

export interface LotteryStats {
  total: number;
  sold: number;
  available: number;
  revenue: number;
  salesExpected: number;
  donationExpected: number;
  lotteryExpected?: number;
  clubExpected?: number;
  expected: number;
  delivered: number;
  difference: number;
  pending: number;
  pendingLottery?: number;
  pendingClub?: number;
  due: number;
  waived: number;
  donation: number;
  salesReceived: number;
  donationReceived: number;
  lotteryReceived?: number;
  clubReceived?: number;
  treasuryDelivered: number;
  treasuryPending: number;
  purchases: number;
  deliveries: number;
}

export interface Lottery {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  draw_date?: string;
  ticket_price: number;
  total_tickets: number;
  lottery_number?: string;
  lottery_number_1?: string;
  lottery_number_2?: string;
  donation_per_ticket: number;
  num_tacos: number;
  tickets_per_taco: number;
  start_number: number;
  end_number?: number;
  sales_status: LotterySalesStatus;
  created_at: string;
  updated_at?: string;
  is_active: boolean;
  club?: Club;
  stats?: Partial<LotteryStats>;
}

export interface TicketBlock {
  id: string;
  lottery_id: string;
  player_id: string | null;
  block_number?: number;
  start_number: number;
  end_number: number;
  created_at: string;
  updated_at?: string;
  player?: Player;
  player_name?: string | null;
  team_names?: string[];
  share_token?: string | null;
  tickets?: Ticket[];
  total?: number;
  sold?: number;
  available?: number;
}

export interface Ticket {
  id: string;
  lottery_id: string;
  ticket_block_id: string;
  number: number;
  status: 'available' | 'sold';
  purchase_id?: string | null;
  sold_at?: string | null;
  created_at: string;
}

export interface LotterySeller {
  id: string;
  lottery_id: string;
  player_id: string;
  share_token: string;
  player_name: string;
  team_names: string[];
  tacos: number;
  total: number;
  sold: number;
  available: number;
  tickets_assigned: number;
  tickets_unsold: number;
  revenue: number;
  donation: number;
  sales_expected: number;
  donation_expected: number;
  lottery_expected: number;
  club_expected: number;
  expected: number;
  sales_received: number;
  donation_received: number;
  lottery_received: number;
  club_received: number;
  delivered: number;
  waived_amount: number;
  waiver_reason?: string | null;
  waived_at?: string | null;
  due_amount: number;
  pending_amount: number;
  pending_lottery: number;
  pending_club: number;
  pending_tickets: number;
  difference: number;
  treasury_delivered: number;
  treasury_pending: number;
  sales_state: LotterySalesState;
  reconciliation_state: LotteryReconciliationState;
  treasury_state: LotteryTreasuryState;
  last_collection_at?: string | null;
  last_settlement_at?: string | null;
  created_at: string;
  player?: Player;
}

export interface TicketPurchase {
  id: string;
  lottery_id: string;
  seller_id: string;
  token: string;
  client_request_id?: string;
  buyer_name: string;
  quantity: number;
  unit_price: number;
  donation_per_ticket: number;
  total_amount: number;
  donation_amount: number;
  status: 'confirmed' | 'void';
  settlement_id?: string | null;
  created_at: string;
  sold_at?: string;
  voided_at?: string | null;
  seller_name?: string;
  ticket_numbers: number[];
  physical_ticket_delivered: boolean;
  collection_status?: 'confirmed' | 'partial' | 'collected' | 'void';
}

export interface LotterySettlement {
  id: string;
  lottery_id: string;
  player_id: string;
  tickets_sold: number;
  expected_amount: number;
  delivered_amount: number;
  sales_received: number;
  donation_received: number;
  lottery_received: number;
  club_received: number;
  payment_method?: string | null;
  status: 'confirmed' | 'void';
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  tickets_assigned: number;
  tickets_unsold: number;
  ticket_price: number;
  donation_per_ticket: number;
  sales_expected: number;
  donation_expected: number;
  total_expected: number;
  treasurer_delivery_id?: string | null;
  treasurer_delivered_at?: string | null;
  notes?: string | null;
  settled_by?: string | null;
  created_at: string;
  player_name?: string;
}

export interface LotteryTreasurerDelivery {
  id: string;
  lottery_id: string;
  amount: number;
  delivered_at: string;
  notes?: string | null;
  snapshot?: Record<string, unknown>;
  status: 'confirmed' | 'void';
  created_by?: string | null;
  created_at: string;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  player_names?: string[];
  player_count?: number;
  settlement_count?: number;
}

export interface LotteryAdminData {
  lottery: Lottery;
  players: Array<Player & { team_names?: string[] }>;
  sellers: LotterySeller[];
  blocks: TicketBlock[];
  purchases: TicketPurchase[];
  settlements: LotterySettlement[];
  deliveries: LotteryTreasurerDelivery[];
}

export interface SellerTicket {
  id: string;
  number: number;
  status: 'available' | 'sold';
}

export interface SellerTaco {
  id: string;
  block_number: number;
  start_number: number;
  end_number: number;
  tickets: SellerTicket[];
}

export interface SellerPurchase {
  id: string;
  token: string;
  buyer_name: string;
  quantity: number;
  unit_price: number;
  donation_per_ticket: number;
  total_amount: number;
  donation_amount: number;
  status: 'confirmed' | 'void';
  created_at: string;
  sold_at?: string;
  voided_at?: string | null;
  ticket_numbers: number[];
  physical_ticket_delivered: boolean;
}

export interface SellerPageData {
  lottery: Lottery;
  seller: {
    player_id: string;
    player_name: string;
    team_names: string[];
    share_token: string;
  };
  tacos: SellerTaco[];
  purchases: SellerPurchase[];
}

export interface SaleResult {
  id: string;
  token: string;
  buyer_name: string;
  quantity: number;
  unit_price: number;
  donation_per_ticket: number;
  total_amount: number;
  donation_amount: number;
  status: 'confirmed' | 'void';
  created_at: string;
  physical_ticket_delivered: boolean;
  tickets: number[];
}

export interface ReceiptData {
  purchase: {
    id: string;
    token: string;
    buyer_name: string;
    quantity: number;
    unit_price: number;
    donation_per_ticket: number;
    total_amount: number;
    donation_amount: number;
    status: 'confirmed' | 'void';
    created_at: string;
    voided_at?: string | null;
    physical_ticket_delivered: boolean;
  };
  lottery: Lottery;
  seller: {
    player_id: string;
    player_name: string;
    team_names: string[];
  };
  tickets: number[];
}

export interface Sponsor {
  id: string;
  club_id: string;
  name: string;
  logo_url?: string;
  website?: string;
  sponsor_level?: string;
  created_at: string;
}

export interface CreateLotteryInput {
  clubId: string;
  name: string;
  description?: string;
  drawDate?: string;
  ticketPrice: number;
  donationPerTicket: number;
  numTacos: number;
  ticketsPerTaco: number;
  startNumber: number;
  lotteryNumber1?: string;
  lotteryNumber2?: string;
  autoAssign?: boolean;
  teamId?: string;
}

export interface DashboardLotteryStats {
  totalSold: number;
  totalRevenue: number;
  totalAvailable: number;
}

export interface LotteryRanking {
  playerId: string;
  playerName: string;
  ticketsSold: number;
  revenue: number;
}

export interface LotteryTeamRanking {
  teamId: string;
  teamName: string;
  ticketsSold: number;
  revenue: number;
}
