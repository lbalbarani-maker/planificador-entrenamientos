import { Club, Player } from './teams';

export type { Club, Player };

export interface Lottery {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  draw_date?: string;
  ticket_price: number;
  total_tickets: number;
  lottery_number?: string;
  created_at: string;
  is_active: boolean;
  club?: Club;
}

export interface TicketBlock {
  id: string;
  lottery_id: string;
  player_id: string;
  start_number: number;
  end_number: number;
  created_at: string;
  player?: Player;
  tickets?: Ticket[];
}

export interface Ticket {
  id: string;
  lottery_id: string;
  ticket_block_id: string;
  number: number;
  status: 'available' | 'reserved' | 'sold';
  buyer_name?: string;
  buyer_phone?: string;
  buyer_email?: string;
  payment_status: 'pending' | 'paid';
  created_at: string;
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
  club_id: string;
  name: string;
  description?: string;
  draw_date?: string;
  ticket_price: number;
  total_tickets: number;
  lottery_number?: string;
}

export interface CreateTicketBlockInput {
  lottery_id: string;
  player_id: string;
  start_number: number;
  end_number: number;
}
