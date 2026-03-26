import { supabase } from './supabase';
import {
  HockeyMatch,
  HockeyPlayer,
  HockeyGoal,
  HockeySave,
  HockeyCard,
  HockeyMatchWithDetails,
  MatchLineup,
  MatchSubstitution,
  CreateMatchInput,
  UpdateMatchInput,
  EditMatchInput,
  AddGoalInput,
  AddSaveInput,
  AddCardInput,
  InitLineupInput,
  ChangePlayerInput,
  LineupPlayer,
  HockeyShootout,
  AddShootoutInput,
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

  async addCard(matchId: string, input: AddCardInput): Promise<HockeyCard> {
    const { data, error } = await supabase
      .from('match_cards')
      .insert([
        {
          match_id: matchId,
          team: input.team,
          player_id: input.player_id || null,
          player_name: input.player_name || null,
          dorsal: input.dorsal || null,
          card_type: input.card_type,
          quarter: input.quarter,
          match_minute: input.match_minute,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding card:', error);
      throw error;
    }

    return data;
  },

  async getMatchCards(matchId: string): Promise<HockeyCard[]> {
    const { data, error } = await supabase
      .from('match_cards')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching match cards:', error);
      return [];
    }

    return data || [];
  },

  async removeCard(cardId: string): Promise<void> {
    const { error } = await supabase
      .from('match_cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      console.error('Error removing card:', error);
      throw error;
    }
  },

  async initLineup(matchId: string, team: 'team1' | 'team2', players: LineupPlayer[]): Promise<void> {
    const lineups = players.map(p => ({
      match_id: matchId,
      player_id: p.player_id,
      player_name: p.player_name,
      dorsal: p.dorsal || null,
      team,
      is_on_field: true,
      time_in_seconds: 0,
      last_in_timestamp: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('match_lineups')
      .insert(lineups);

    if (error) {
      console.error('Error initializing lineup:', error);
      throw error;
    }
  },

  async getLineup(matchId: string): Promise<MatchLineup[]> {
    const { data, error } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('match_id', matchId)
      .order('is_on_field', { ascending: false });

    if (error) {
      console.error('Error fetching lineup:', error);
      return [];
    }

    return data || [];
  },

  async changePlayer(matchId: string, input: ChangePlayerInput): Promise<void> {
    const now = new Date().toISOString();

    const { data: lineup, error: fetchError } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('match_id', matchId)
      .eq('team', input.team)
      .eq('player_id', input.player_out_id)
      .single();

    if (fetchError || !lineup) {
      console.error('Error fetching player to change out:', fetchError);
      throw fetchError;
    }

    const timeInSeconds = lineup.time_in_seconds + Math.floor(
      (new Date().getTime() - new Date(lineup.last_in_timestamp).getTime()) / 1000
    );

    await supabase
      .from('match_lineups')
      .update({
        is_on_field: false,
        time_in_seconds: timeInSeconds,
      })
      .eq('id', lineup.id);

    const { data: newPlayer, error: newPlayerError } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('match_id', matchId)
      .eq('team', input.team)
      .eq('player_id', input.player_in_id)
      .single();

    if (newPlayerError || !newPlayer) {
      console.error('Error finding new player in lineup:', newPlayerError);
      throw newPlayerError;
    }

    await supabase
      .from('match_lineups')
      .update({
        is_on_field: true,
        last_in_timestamp: now,
      })
      .eq('id', newPlayer.id);

    const { data: match } = await supabase
      .from('hockey_matches')
      .select('quarter, remaining_time, quarter_duration')
      .eq('id', matchId)
      .single();

    const matchMinute = match ? (match.quarter - 1) * (match.quarter_duration / 60) + Math.floor((match.quarter_duration - match.remaining_time) / 60) : 0;

    await supabase
      .from('match_substitutions')
      .insert({
        match_id: matchId,
        player_out_id: input.player_out_id,
        player_in_id: input.player_in_id,
        player_in_name: input.player_in_name,
        player_in_dorsal: input.player_in_dorsal || null,
        team: input.team,
        quarter: match?.quarter || 1,
        match_minute: matchMinute,
      });
  },

  async quickSubstitution(matchId: string, team: 'team1' | 'team2'): Promise<void> {
    const { data: lastSub, error } = await supabase
      .from('match_substitutions')
      .select('*')
      .eq('match_id', matchId)
      .eq('team', team)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !lastSub) {
      console.error('No previous substitution found:', error);
      throw error || new Error('No previous substitution');
    }

    await this.changePlayer(matchId, {
      player_out_id: lastSub.player_in_id,
      player_in_id: lastSub.player_out_id,
      player_in_name: lastSub.player_out_name,
      player_in_dorsal: lastSub.player_out_dorsal || undefined,
      team,
    });
  },

  async getSubstitutions(matchId: string): Promise<MatchSubstitution[]> {
    const { data, error } = await supabase
      .from('match_substitutions')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching substitutions:', error);
      return [];
    }

    return data || [];
  },

  async addPenalty(matchId: string, input: {
    event_type: 'penalty_goal' | 'penalty_miss' | 'stroke_goal' | 'stroke_miss';
    team: 'team1' | 'team2';
    player_id?: string;
    player_name?: string;
    dorsal?: string;
    quarter: number;
    match_minute: number;
  }): Promise<void> {
    const { error } = await supabase
      .from('match_events')
      .insert([{
        match_id: matchId,
        event_type: input.event_type,
        team_id: input.team,
        player_id: input.player_id || null,
        player_name: input.player_name || null,
        dorsal: input.dorsal || null,
        minute: input.match_minute,
      }]);

    if (error) {
      console.error('Error adding penalty:', error);
      throw error;
    }
  },

  async getMatchPenalties(matchId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .in('event_type', ['penalty_goal', 'penalty_miss', 'stroke_goal', 'stroke_miss'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching penalties:', error);
      return [];
    }

    return (data || []).map((event: any) => ({
      id: event.id,
      match_id: event.match_id,
      event_type: event.event_type,
      team: event.team_id,
      player_id: event.player_id,
      player_name: event.player_name,
      dorsal: event.dorsal,
      quarter: event.quarter || 4,
      match_minute: event.minute || 0,
      created_at: event.created_at,
    }));
  },

  async removePenalty(id: string): Promise<void> {
    const { error } = await supabase
      .from('match_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing penalty:', error);
      throw error;
    }
  },

  async addShootout(matchId: string, input: AddShootoutInput): Promise<HockeyShootout> {
    const { data, error } = await supabase
      .from('match_shootouts')
      .insert([{
        match_id: matchId,
        team: input.team,
        player_id: input.player_id || null,
        player_name: input.player_name,
        dorsal: input.dorsal || null,
        scored: input.scored,
        round_number: input.round_number,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding shootout:', error);
      throw error;
    }

    return data;
  },

  async getMatchShootouts(matchId: string): Promise<HockeyShootout[]> {
    const { data, error } = await supabase
      .from('match_shootouts')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching shootouts:', error);
      return [];
    }

    return data || [];
  },

  async removeShootout(id: string): Promise<void> {
    const { error } = await supabase
      .from('match_shootouts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing shootout:', error);
      throw error;
    }
  },
};
