import { supabase } from './supabase';
import {
  DashboardLotteryStats,
  LotteryRanking,
  LotteryTeamRanking,
  ReceiptData,
  SaleResult,
  SellerPageData,
  Sponsor,
} from '../types/lottery';

function rpcError(error: { message?: string } | null): never {
  throw new Error(error?.message || 'No se pudo completar la operación');
}

export const lotteryApi = {
  async getSellerPage(token: string): Promise<SellerPageData | null> {
    const { data, error } = await supabase.rpc('get_lottery_seller', { p_token: token });
    if (error) rpcError(error);
    return (data as SellerPageData | null) ?? null;
  },

  async createSale(
    token: string,
    buyerName: string,
    ticketIds: string[],
    clientRequestId: string,
    physicalTicketDelivered: boolean,
  ): Promise<SaleResult> {
    const { data, error } = await supabase.rpc('create_lottery_sale', {
      p_token: token,
      p_buyer_name: buyerName,
      p_ticket_ids: ticketIds,
      p_client_request_id: clientRequestId,
      p_physical_ticket_delivered: physicalTicketDelivered,
    });
    if (error) rpcError(error);
    return data as SaleResult;
  },

  async getReceipt(token: string): Promise<ReceiptData | null> {
    const { data, error } = await supabase.rpc('get_lottery_receipt', { p_token: token });
    if (error) rpcError(error);
    return (data as ReceiptData | null) ?? null;
  },

  async getGlobalLotteryStats(): Promise<DashboardLotteryStats> {
    const { data, error } = await supabase.rpc('get_lottery_dashboard_stats');
    if (error) rpcError(error);
    return data as DashboardLotteryStats;
  },

  async getRankings(
    limit = 10,
  ): Promise<{ players: LotteryRanking[]; teams: LotteryTeamRanking[] }> {
    const { data, error } = await supabase.rpc('get_lottery_rankings', { p_limit: limit });
    if (error) rpcError(error);
    return data as { players: LotteryRanking[]; teams: LotteryTeamRanking[] };
  },

  async getTopPlayerSellers(limit = 10): Promise<LotteryRanking[]> {
    const rankings = await this.getRankings(limit);
    return rankings.players;
  },

  async getTopTeamSellers(limit = 5): Promise<LotteryTeamRanking[]> {
    const rankings = await this.getRankings(limit);
    return rankings.teams;
  },

  async getSponsors(clubId: string): Promise<Sponsor[]> {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (error) rpcError(error);
    return data || [];
  },
};
