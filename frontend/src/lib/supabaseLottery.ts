import { supabase } from './supabase';
import { Lottery, TicketBlock, Ticket, Sponsor, CreateLotteryInput, CreateTicketBlockInput } from '../types/lottery';

export const lotteryApi = {
  async getLotteries(clubId?: string): Promise<Lottery[]> {
    let query = supabase
      .from('lotteries')
      .select('*, club:clubs(*)')
      .order('created_at', { ascending: false });

    if (clubId) {
      query = query.eq('club_id', clubId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getLottery(id: string): Promise<Lottery | null> {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*, club:clubs(*)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async createLottery(input: CreateLotteryInput): Promise<Lottery> {
    const { data, error } = await supabase
      .from('lotteries')
      .insert([{ ...input, is_active: true }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateLottery(id: string, updates: Partial<Lottery>): Promise<Lottery> {
    const { data, error } = await supabase
      .from('lotteries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteLottery(id: string): Promise<void> {
    const { error } = await supabase
      .from('lotteries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async generateTickets(lotteryId: string, startNumber: number, totalTickets: number): Promise<void> {
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('number')
      .eq('lottery_id', lotteryId);

    if (existingTickets && existingTickets.length > 0) {
      throw new Error('Los tickets ya han sido generados para esta lotería');
    }

    const tickets = [];
    for (let i = 0; i < totalTickets; i++) {
      tickets.push({
        lottery_id: lotteryId,
        number: startNumber + i,
        status: 'available',
        payment_status: 'pending'
      });
    }

    const { error } = await supabase
      .from('tickets')
      .insert(tickets);

    if (error) throw error;
  },

  async createTicketBlocks(blocks: { lottery_id: string; player_id: string | null; start_number: number; end_number: number }[]): Promise<void> {
    const { error } = await supabase
      .from('ticket_blocks')
      .insert(blocks);

    if (error) throw error;
  },

  async getTicketBlocks(lotteryId: string): Promise<TicketBlock[]> {
    const { data, error } = await supabase
      .from('ticket_blocks')
      .select('*, player:players(*), tickets(*)')
      .eq('lottery_id', lotteryId);

    if (error) throw error;
    return data || [];
  },

  async createTicketBlock(input: CreateTicketBlockInput): Promise<TicketBlock> {
    const { data: block, error } = await supabase
      .from('ticket_blocks')
      .insert([input])
      .select()
      .single();

    if (error) throw error;

    const tickets = [];
    for (let i = input.start_number; i <= input.end_number; i++) {
      tickets.push({
        lottery_id: input.lottery_id,
        ticket_block_id: block.id,
        number: i,
        status: 'available',
        payment_status: 'pending'
      });
    }

    await supabase.from('tickets').insert(tickets);

    return block;
  },

  async updateTicketBlock(blockId: string, updates: { player_id: string }): Promise<TicketBlock> {
    const { data, error } = await supabase
      .from('ticket_blocks')
      .update(updates)
      .eq('id', blockId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async generateTicketsForBlock(block: TicketBlock): Promise<void> {
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id')
      .eq('ticket_block_id', block.id);

    if (existingTickets && existingTickets.length > 0) {
      return;
    }

    const tickets = [];
    for (let i = block.start_number; i <= block.end_number; i++) {
      tickets.push({
        lottery_id: block.lottery_id,
        ticket_block_id: block.id,
        number: i,
        status: 'available',
        payment_status: 'pending'
      });
    }

    if (tickets.length > 0) {
      await supabase.from('tickets').insert(tickets);
    }
  },

  async getPlayerTicketBlocks(playerId: string): Promise<TicketBlock[]> {
    const { data, error } = await supabase
      .from('ticket_blocks')
      .select('*, lottery:lotteries(*), tickets(*)')
      .eq('player_id', playerId);

    if (error) throw error;
    return data || [];
  },

  async getTickets(lotteryId: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('lottery_id', lotteryId)
      .order('number', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getTicketBlockTickets(blockId: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('ticket_block_id', blockId)
      .order('number', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async reserveTicket(ticketId: string, buyerData: { name: string; phone: string; email: string }): Promise<Ticket> {
    const { data, error } = await supabase
      .from('tickets')
      .update({
        status: 'reserved',
        buyer_name: buyerData.name,
        buyer_phone: buyerData.phone,
        buyer_email: buyerData.email
      })
      .eq('id', ticketId)
      .eq('status', 'available')
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTicketStatus(ticketId: string, status: 'available' | 'reserved' | 'sold', paymentStatus?: 'pending' | 'paid', buyerData?: { name: string; phone: string; email: string }): Promise<Ticket> {
    const updates: any = { status };
    if (paymentStatus) updates.payment_status = paymentStatus;
    if (buyerData) {
      updates.buyer_name = buyerData.name;
      updates.buyer_phone = buyerData.phone;
      updates.buyer_email = buyerData.email;
    }

    const { data, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getLotteryStats(lotteryId: string): Promise<{ total: number; sold: number; available: number; reserved: number; revenue: number }> {
    const lottery = await this.getLottery(lotteryId);
    const ticketBlocks = await this.getTicketBlocks(lotteryId);
    
    const totalFromLottery = lottery?.total_tickets || 0;
    let sold = 0;
    let reserved = 0;
    
    for (const block of ticketBlocks) {
      const tickets = block.tickets || [];
      const blockSold = tickets.filter((t: any) => t.status === 'sold').length;
      const blockReserved = tickets.filter((t: any) => t.status === 'reserved').length;
      
      sold += blockSold;
      reserved += blockReserved;
    }

    const assignedTickets = sold + reserved;
    const available = totalFromLottery - assignedTickets;
    const revenue = sold * (lottery?.ticket_price || 0);

    return { total: totalFromLottery, sold, available, reserved, revenue };
  },

  async getSponsors(clubId: string): Promise<Sponsor[]> {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createSponsor(sponsor: Omit<Sponsor, 'id' | 'created_at'>): Promise<Sponsor> {
    const { data, error } = await supabase
      .from('sponsors')
      .insert([sponsor])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getGlobalLotteryStats(): Promise<{ totalSold: number; totalRevenue: number; totalAvailable: number }> {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('status, payment_status, number');

    if (error) throw error;
    
    const sold = tickets?.filter(t => t.status === 'sold').length || 0;
    const available = tickets?.filter(t => t.status === 'available').length || 0;
    
    return {
      totalSold: sold,
      totalRevenue: sold * 5,
      totalAvailable: available
    };
  },

  async getTopPlayerSellers(limit: number = 10): Promise<{ playerId: string; playerName: string; ticketsSold: number; revenue: number }[]> {
    const { data: blocks, error } = await supabase
      .from('ticket_blocks')
      .select('*, player:players(id, full_name), tickets(*)')
      .not('player_id', 'is', null);

    if (error) throw error;

    const playerStats: Record<string, { name: string; sold: number; revenue: number }> = {};

    blocks?.forEach(block => {
      const playerId = block.player?.id;
      const playerName = block.player?.full_name || 'Unknown';
      
      if (!playerStats[playerId]) {
        playerStats[playerId] = { name: playerName, sold: 0, revenue: 0 };
      }

      const soldTickets = (block.tickets || []).filter((t: any) => t.status === 'sold');
      playerStats[playerId].sold += soldTickets.length;
      playerStats[playerId].revenue += soldTickets.length * 5;
    });

    return Object.entries(playerStats)
      .map(([playerId, stats]) => ({
        playerId,
        playerName: stats.name,
        ticketsSold: stats.sold,
        revenue: stats.revenue
      }))
      .sort((a, b) => b.ticketsSold - a.ticketsSold)
      .slice(0, limit);
  },

  async getTopTeamSellers(limit: number = 5): Promise<{ teamId: string; teamName: string; ticketsSold: number; revenue: number }[]> {
    const { data: blocks, error } = await supabase
      .from('ticket_blocks')
      .select('id, player_id')
      .not('player_id', 'is', null);

    if (error) throw error;

    const blockIds = blocks?.map(b => b.id) || [];
    
    let ticketsData: any[] = [];
    if (blockIds.length > 0) {
      const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .in('ticket_block_id', blockIds)
        .eq('status', 'sold');
      ticketsData = tickets || [];
    }

    const playerIds = Array.from(new Set(blocks?.map(b => b.player_id).filter(Boolean) || []));
    
    let playerTeams: Record<string, { teamId: string; teamName: string }> = {};
    
    if (playerIds.length > 0) {
      const { data: teamPlayersData } = await supabase
        .from('team_players')
        .select('player_id, teams(id, name)')
        .in('player_id', playerIds);
      
      (teamPlayersData || []).forEach((tp: any) => {
        if (tp.player_id && tp.teams) {
          playerTeams[tp.player_id] = { teamId: tp.teams.id, teamName: tp.teams.name };
        }
      });
    }

    const teamStats: Record<string, { name: string; sold: number; revenue: number }> = {};

    blocks?.forEach(block => {
      const teamInfo = playerTeams[block.player_id] || { teamId: 'sin-equipo', teamName: 'Sin equipo' };
      const teamId = teamInfo.teamId;
      const teamName = teamInfo.teamName;

      if (!teamStats[teamId]) {
        teamStats[teamId] = { name: teamName, sold: 0, revenue: 0 };
      }

      const soldTickets = ticketsData.filter(t => t.ticket_block_id === block.id);
      teamStats[teamId].sold += soldTickets.length;
      teamStats[teamId].revenue += soldTickets.length * 5;
    });

    return Object.entries(teamStats)
      .map(([teamId, stats]) => ({
        teamId,
        teamName: stats.name,
        ticketsSold: stats.sold,
        revenue: stats.revenue
      }))
      .sort((a, b) => b.ticketsSold - a.ticketsSold)
      .slice(0, limit);
  }
};
