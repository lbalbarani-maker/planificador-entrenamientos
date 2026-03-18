import { supabase } from './supabase';
import {
  HockeyMatch,
  HockeyPlayer,
  HockeyGoal,
  HockeySave,
  HockeyMatchWithDetails,
  CreateMatchInput,
  UpdateMatchInput,
  EditMatchInput,
  AddGoalInput,
  AddSaveInput,
} from '../types/hockey';

const getCurrentUser = async () => {
  try {
    const userData = localStorage.getItem('user');
    if (!userData) {
      throw new Error('Usuario no autenticado');
    }
    const user = JSON.parse(userData);
    return { id: user.id };
  } catch (error) {
    console.error('Error getting user:', error);
    throw new Error('Usuario no autenticado');
  }
};

const hashPin = async (pin: string): Promise<string> => {
  const enc = new TextEncoder();
  const data = enc.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const hockeyApi = {
  async createMatch(input: CreateMatchInput): Promise<HockeyMatch> {
    const user = await getCurrentUser();
    
    const adminPinHash = input.admin_pin ? await hashPin(input.admin_pin) : null;

    const { data, error } = await supabase
      .from('hockey_matches')
      .insert([
        {
          team1_name: input.team1_name,
          team1_color: input.team1_color,
          team1_logo_url: input.team1_logo_url || null,
          team2_name: input.team2_name,
          team2_color: input.team2_color,
          team2_logo_url: input.team2_logo_url || null,
          quarter_duration: input.quarter_duration || 900,
          remaining_time: input.quarter_duration || 900,
          sponsor_logo_url: input.sponsor_logo_url || null,
          sponsor_name: input.sponsor_name || null,
          sponsor_text: input.sponsor_text || null,
          youtube_url: input.youtube_url || null,
          admin_pin_hash: adminPinHash,
          status: 'pending',
          quarter: 1,
          score_team1: 0,
          score_team2: 0,
          running: false,
          event_id: input.event_id || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating match:', error);
      throw error;
    }

    return data;
  },

  async getMatch(id: string): Promise<HockeyMatch | null> {
    const { data, error } = await supabase
      .from('hockey_matches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching match:', error);
      return null;
    }

    return data;
  },

  async getMatchByToken(token: string): Promise<HockeyMatch | null> {
    const { data, error } = await supabase
      .from('hockey_matches')
      .select('*')
      .eq('share_token', token)
      .single();

    if (error) {
      console.error('Error fetching match by token:', error);
      return null;
    }

    return data;
  },

  async getMatchWithDetails(id: string): Promise<HockeyMatchWithDetails | null> {
    const match = await this.getMatch(id);
    if (!match) return null;

    const [players, goals, saves] = await Promise.all([
      this.getMatchPlayers(id),
      this.getMatchGoals(id),
      this.getMatchSaves(id),
    ]);

    return {
      ...match,
      players,
      goals,
      saves,
    };
  },

  async getUserMatches(): Promise<HockeyMatch[]> {
    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from('hockey_matches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching user matches:', error);
      return [];
    }

    return data || [];
  },

  async updateMatch(id: string, input: UpdateMatchInput): Promise<HockeyMatch> {
    const { data, error } = await supabase
      .from('hockey_matches')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating match:', error);
      throw error;
    }

    return data;
  },

  async updateMatchFull(
    id: string, 
    matchInput: Partial<EditMatchInput>, 
    players: HockeyPlayer[]
  ): Promise<HockeyMatch> {
    // Solo actualizar campos que existen en la tabla hockey_matches
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    // Solo incluir campos que existen en la tabla
    if (matchInput.quarter_duration !== undefined) updateData.quarter_duration = matchInput.quarter_duration;
    if (matchInput.youtube_url !== undefined) updateData.youtube_url = matchInput.youtube_url || null;
    if (matchInput.sponsor_logo_url !== undefined) updateData.sponsor_logo_url = matchInput.sponsor_logo_url || null;
    if (matchInput.sponsor_name !== undefined) updateData.sponsor_name = matchInput.sponsor_name || null;
    if (matchInput.sponsor_text !== undefined) updateData.sponsor_text = matchInput.sponsor_text || null;
    
    const { data, error } = await supabase
      .from('hockey_matches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating match:', error);
      throw error;
    }

    if (players.length > 0) {
      const { error: deleteError } = await supabase
        .from('hockey_players')
        .delete()
        .eq('match_id', id);

      if (deleteError) {
        console.error('Error deleting old players:', deleteError);
        throw deleteError;
      }

      const playersToInsert = players.map(p => ({
        match_id: id,
        team: p.team,
        player_name: p.player_name,
        dorsal: p.dorsal || null,
        position: p.position || null,
        is_goalkeeper: p.is_goalkeeper,
      }));

      const { error: insertError } = await supabase
        .from('hockey_players')
        .insert(playersToInsert);

      if (insertError) {
        console.error('Error inserting players:', insertError);
        throw insertError;
      }
    }

    return data;
  },

  async deleteMatch(id: string): Promise<void> {
    const { error } = await supabase
      .from('hockey_matches')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting match:', error);
      throw error;
    }
  },

  async deleteMatchByEventId(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('hockey_matches')
      .delete()
      .eq('event_id', eventId);

    if (error) {
      console.error('Error deleting match by event_id:', error);
    }
  },

  async setMatchPlayers(matchId: string, players: HockeyPlayer[]): Promise<void> {
    const { error: deleteError } = await supabase
      .from('hockey_players')
      .delete()
      .eq('match_id', matchId);

    if (deleteError) {
      console.error('Error deleting old players:', deleteError);
      throw deleteError;
    }

    if (players.length === 0) return;

    const playersToInsert = players.map(p => ({
      match_id: matchId,
      team: p.team,
      player_name: p.player_name,
      dorsal: p.dorsal || null,
      position: p.position || null,
      is_goalkeeper: p.is_goalkeeper,
    }));

    const { error: insertError } = await supabase
      .from('hockey_players')
      .insert(playersToInsert);

    if (insertError) {
      console.error('Error inserting players:', insertError);
      throw insertError;
    }
  },

  async getMatchPlayers(matchId: string): Promise<HockeyPlayer[]> {
    const { data, error } = await supabase
      .from('hockey_players')
      .select('*')
      .eq('match_id', matchId);

    if (error) {
      console.error('Error fetching match players:', error);
      return [];
    }

    return data || [];
  },

  async addGoal(matchId: string, input: AddGoalInput): Promise<HockeyGoal> {
    const { data, error } = await supabase
      .from('hockey_goals')
      .insert([
        {
          match_id: matchId,
          team: input.team,
          player_id: input.player_id || null,
          player_name: input.player_name,
          dorsal: input.dorsal || null,
          quarter: input.quarter,
          elapsed_in_quarter: input.elapsed_in_quarter,
          match_minute: input.match_minute,
          is_penalty: input.is_penalty || false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding goal:', error);
      throw error;
    }

    const match = await this.getMatch(matchId);
    if (match) {
      const newScore1 = input.team === 'team1' ? match.score_team1 + 1 : match.score_team1;
      const newScore2 = input.team === 'team2' ? match.score_team2 + 1 : match.score_team2;
      await this.updateMatch(matchId, {
        score_team1: newScore1,
        score_team2: newScore2,
      });
    }

    return data;
  },

  async removeGoal(goalId: string): Promise<void> {
    const { data: goal, error: fetchError } = await supabase
      .from('hockey_goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (fetchError || !goal) {
      console.error('Error fetching goal to remove:', fetchError);
      return;
    }

    const match = await this.getMatch(goal.match_id);
    if (match) {
      const newScore1 = goal.team === 'team1' ? Math.max(0, match.score_team1 - 1) : match.score_team1;
      const newScore2 = goal.team === 'team2' ? Math.max(0, match.score_team2 - 1) : match.score_team2;
      await this.updateMatch(goal.match_id, {
        score_team1: newScore1,
        score_team2: newScore2,
      });
    }

    const { error } = await supabase
      .from('hockey_goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      console.error('Error removing goal:', error);
      throw error;
    }
  },

  async removeSave(saveId: string): Promise<void> {
    const { error } = await supabase
      .from('hockey_saves')
      .delete()
      .eq('id', saveId);

    if (error) {
      console.error('Error removing save:', error);
      throw error;
    }
  },

  async getMatchGoals(matchId: string): Promise<HockeyGoal[]> {
    const { data, error } = await supabase
      .from('hockey_goals')
      .select('*')
      .eq('match_id', matchId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching match goals:', error);
      return [];
    }

    return data || [];
  },

  async addSave(matchId: string, input: AddSaveInput): Promise<HockeySave> {
    const { data, error } = await supabase
      .from('hockey_saves')
      .insert([
        {
          match_id: matchId,
          team: input.team,
          player_id: input.player_id || null,
          player_name: input.player_name || null,
          dorsal: input.dorsal || null,
          quarter: input.quarter,
          elapsed_in_quarter: input.elapsed_in_quarter || null,
          match_minute: input.match_minute,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding save:', error);
      throw error;
    }

    return data;
  },

  async getMatchSaves(matchId: string): Promise<HockeySave[]> {
    const { data, error } = await supabase
      .from('hockey_saves')
      .select('*')
      .eq('match_id', matchId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching match saves:', error);
      return [];
    }

    return data || [];
  },

  async verifyPin(matchId: string, pin: string): Promise<boolean> {
    const match = await this.getMatch(matchId);
    if (!match || !match.admin_pin_hash) return false;

    const pinHash = await hashPin(pin);
    return pinHash === match.admin_pin_hash;
  },

  subscribeToMatch(
    matchId: string,
    callback: (match: HockeyMatch) => void
  ): () => void {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hockey_matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as HockeyMatch);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToGoals(
    matchId: string,
    callback: (goals: HockeyGoal[]) => void
  ): () => void {
    const channel = supabase
      .channel(`goals:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hockey_goals',
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          const goals = await this.getMatchGoals(matchId);
          callback(goals);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
