import { supabase } from './supabase';
import { Tournament, Season, Matchday, Standing, MatchEvent } from '../types/tournaments';

export const tournamentsApi = {
  // Seasons
  async getSeasons(): Promise<Season[]> {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('name', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async createSeason(season: Partial<Season>): Promise<Season> {
    const { data, error } = await supabase
      .from('seasons')
      .insert([season])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateSeason(id: string, updates: Partial<Season>): Promise<Season> {
    const { data, error } = await supabase
      .from('seasons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteSeason(id: string): Promise<void> {
    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Tournaments
  async getTournaments(seasonId?: string): Promise<Tournament[]> {
    let query = supabase
      .from('tournaments')
      .select('*, season:seasons(*)')
      .order('name');
    
    if (seasonId) {
      query = query.eq('season_id', seasonId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getTournament(id: string): Promise<Tournament | null> {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*, season:seasons(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async createTournament(tournament: Partial<Tournament>): Promise<Tournament> {
    const { data, error } = await supabase
      .from('tournaments')
      .insert([tournament])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTournament(id: string, updates: Partial<Tournament>): Promise<Tournament> {
    const { data, error } = await supabase
      .from('tournaments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteTournament(id: string): Promise<void> {
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Auto-create friendly tournaments when season is created
  async createFriendlyTournaments(seasonId: string): Promise<void> {
    const friendlyTournaments = [
      {
        season_id: seasonId,
        name: 'Amistoso',
        modality: 'field',
        competition_type: 'friendly',
        is_system: true
      },
      {
        season_id: seasonId,
        name: 'Amistoso Sala',
        modality: 'indoor',
        competition_type: 'friendly',
        is_system: true
      }
    ];

    const { error } = await supabase
      .from('tournaments')
      .insert(friendlyTournaments);
    
    if (error) throw error;
  },

  // Matchdays
  async getMatchdays(tournamentId: string): Promise<Matchday[]> {
    const { data, error } = await supabase
      .from('matchdays')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');
    
    if (error) throw error;
    return data || [];
  },

  async createMatchday(matchday: Partial<Matchday>): Promise<Matchday> {
    const { data, error } = await supabase
      .from('matchdays')
      .insert([matchday])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateMatchday(id: string, updates: Partial<Matchday>): Promise<Matchday> {
    const { data, error } = await supabase
      .from('matchdays')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteMatchday(id: string): Promise<void> {
    const { error } = await supabase
      .from('matchdays')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Standings
  async getStandings(tournamentId: string): Promise<Standing[]> {
    const { data, error } = await supabase
      .from('standings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('points', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async recalculateStandings(tournamentId: string): Promise<Standing[]> {
    // Get all finished matches for this tournament
    const { data: matches } = await supabase
      .from('events')
      .select('*, team:teams(name)')
      .eq('tournament_id', tournamentId)
      .eq('type', 'match')
      .eq('status', 'completed');

    if (!matches || matches.length === 0) {
      return [];
    }

    // Calculate standings
    const standingsMap = new Map<string, Standing>();

    for (const match of matches) {
      const homeTeamId = match.team_id;
      const homeTeamName = match.team?.name || 'Equipo Local';
      const awayTeamId = match.opponent_team_id || 'opponent_' + match.id;
      const awayTeamName = match.opponent || 'Equipo Visitante';
      
      // Determine scores from match events or use stored scores
      const homeScore = match.home_score || 0;
      const awayScore = match.away_score || 0;

      // Update home team
      if (!standingsMap.has(homeTeamId)) {
        standingsMap.set(homeTeamId, {
          id: '',
          tournament_id: tournamentId,
          team_id: homeTeamId,
          team_name: homeTeamName,
          played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, goal_difference: 0, points: 0
        });
      }
      const homeStanding = standingsMap.get(homeTeamId)!;
      homeStanding.played++;
      homeStanding.goals_for += homeScore;
      homeStanding.goals_against += awayScore;
      if (homeScore > awayScore) {
        homeStanding.wins++;
        homeStanding.points += 3;
      } else if (homeScore === awayScore) {
        homeStanding.draws++;
        homeStanding.points += 1;
      } else {
        homeStanding.losses++;
      }

      // Update away team
      if (!standingsMap.has(awayTeamId)) {
        standingsMap.set(awayTeamId, {
          id: '',
          tournament_id: tournamentId,
          team_id: awayTeamId,
          team_name: awayTeamName,
          played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, goal_difference: 0, points: 0
        });
      }
      const awayStanding = standingsMap.get(awayTeamId)!;
      awayStanding.played++;
      awayStanding.goals_for += awayScore;
      awayStanding.goals_against += homeScore;
      if (awayScore > homeScore) {
        awayStanding.wins++;
        awayStanding.points += 3;
      } else if (awayScore === homeScore) {
        awayStanding.draws++;
        awayStanding.points += 1;
      } else {
        awayStanding.losses++;
      }
    }

    // Calculate goal difference and update standings
    const standings = Array.from(standingsMap.values()).map(s => ({
      ...s,
      goal_difference: s.goals_for - s.goals_against
    })).sort((a, b) => b.points - a.points || b.goal_difference - a.goal_difference);

    // Delete existing standings
    await supabase.from('standings').delete().eq('tournament_id', tournamentId);

    // Insert new standings
    if (standings.length > 0) {
      const { error } = await supabase.from('standings').insert(standings);
      if (error) throw error;
    }

    return standings;
  },

  // Match Events
  async getMatchEvents(eventId: string): Promise<MatchEvent[]> {
    const { data, error } = await supabase
      .from('match_events')
      .select('*, player:players(full_name), team:teams(name)')
      .eq('event_id', eventId)
      .order('minute');
    
    if (error) throw error;
    return data || [];
  },

  async createMatchEvent(event: Partial<MatchEvent>): Promise<MatchEvent> {
    const { data, error } = await supabase
      .from('match_events')
      .insert([event])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteMatchEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('match_events')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
