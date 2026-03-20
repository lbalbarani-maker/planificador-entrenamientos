import { supabase } from './supabase';
import {
  Club,
  Team,
  Player,
  TeamPlayer,
  Event,
  Convocation,
  CreateTeamInput,
  CreateEventInput,
  CreateConvocationInput,
  Field,
  OpponentTeam,
  Training,
  Location,
} from '../types/teams';

export const trainingsApi = {
  async getAllTrainings(): Promise<Training[]> {
    const { data, error } = await supabase
      .from('trainings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trainings:', error);
      return [];
    }
    return data || [];
  },

  async getTraining(id: string): Promise<Training | null> {
    const { data, error } = await supabase
      .from('trainings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },
};

const getCurrentUser = async () => {
  const userData = localStorage.getItem('user');
  if (!userData) throw new Error('Usuario no autenticado');
  return JSON.parse(userData);
};

export const teamsApi = {
  async getTeams(): Promise<Team[]> {
    const userData = localStorage.getItem('user');
    console.log('getTeams - user from localStorage:', userData ? JSON.parse(userData) : null);
    
    const { data, error } = await supabase
      .from('teams')
      .select('*, club:clubs(id, name, logo_url, primary_color, secondary_color)')
      .order('created_at', { ascending: false });

    console.log('getTeams - query result:', { data, error });
    
    if (error) {
      console.error('getTeams - error:', error);
      throw error;
    }
    return data || [];
  },

  async createTeam(input: CreateTeamInput): Promise<Team> {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('teams')
      .insert([
        {
          club_id: user.club_id,
          name: input.name,
          category: input.category,
          gender: input.gender,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTeam(id: string, input: Partial<CreateTeamInput>): Promise<Team> {
    const { data, error } = await supabase
      .from('teams')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTeam(id: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getPlayers(): Promise<Player[]> {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createPlayer(fullName: string, birthDate?: string, extras?: { dorsal?: number; position?: string }): Promise<Player> {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('players')
      .insert([
        {
          club_id: user.club_id,
          full_name: fullName,
          birth_date: birthDate,
          dorsal: extras?.dorsal,
          position: extras?.position,
          is_minor: false,
          is_self_managed: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getTeamPlayers(teamId: string): Promise<TeamPlayer[]> {
    console.log('getTeamPlayers - teamId:', teamId);
    
    const { data: allPlayers, error: allError } = await supabase
      .from('team_players')
      .select('*');
    
    console.log('All team_players count:', allPlayers?.length);
    
    const { data, error } = await supabase
      .from('team_players')
      .select('*, player:players(id, full_name, dorsal, position)')
      .eq('team_id', teamId);

    console.log('getTeamPlayers - result:', { data, error, count: data?.length });
    
    if (error) {
      console.error('getTeamPlayers - error:', error);
      throw error;
    }
    return data || [];
  },

  async getAvailablePlayers(clubId: string): Promise<Player[]> {
    const { data: assignedPlayers } = await supabase
      .from('team_players')
      .select('player_id');
    
    const assignedIds = (assignedPlayers || []).map(p => p.player_id);
    
    let query = supabase
      .from('players')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('full_name');
    
    if (assignedIds.length > 0) {
      query = query.not('id', 'in', `(${assignedIds.join(',')})`);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  async addPlayerToTeam(teamId: string, playerId: string, shirtNumber?: number, position?: string): Promise<TeamPlayer> {
    const { data, error } = await supabase
      .from('team_players')
      .insert([
        {
          team_id: teamId,
          player_id: playerId,
          shirt_number: shirtNumber,
          position: position,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removePlayerFromTeam(teamPlayerId: string): Promise<void> {
    const { error } = await supabase
      .from('team_players')
      .delete()
      .eq('id', teamPlayerId);

    if (error) throw error;
  },

  async updateTeamPlayer(teamPlayerId: string, updates: { shirt_number?: number; position?: string; is_active?: boolean }): Promise<TeamPlayer> {
    const { data, error } = await supabase
      .from('team_players')
      .update(updates)
      .eq('id', teamPlayerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const eventsApi = {
  async getEvents(teamId?: string): Promise<Event[]> {
    let query = supabase
      .from('events')
      .select('*, team:teams(*, club:clubs(*))')
      .order('start_datetime', { ascending: true });

    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getEvent(eventId: string): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events')
      .select('*, team:teams(*, club:clubs(*))')
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching event:', error);
      return null;
    }
    return data;
  },

  async getUpcomingEvents(limit: number = 10): Promise<Event[]> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('events')
      .select('*, team:teams(*, club:clubs(*))')
      .gte('start_datetime', sevenDaysAgo)
      .order('start_datetime', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async getAllEvents(): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*, team:teams(*, club:clubs(*))')
      .order('start_datetime', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createEvent(input: CreateEventInput): Promise<Event> {
    console.log('=== API createEvent ===');
    console.log('Input:', input);
    const { data, error } = await supabase
      .from('events')
      .insert([input])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    console.log('Created event:', data);
    return data;
  },

  async updateEvent(id: string, input: Partial<CreateEventInput>): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async linkTraining(eventId: string, trainingId: string | null): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .update({ training_id: trainingId })
      .eq('id', eventId)
      .select('*, team:teams(*)')
      .single();

    if (error) throw error;
    return data;
  },
};

export const convocationApi = {
  async getConvocation(eventId: string, teamId?: string): Promise<Convocation[]> {
    const { data, error } = await supabase
      .from('convocation')
      .select('*')
      .eq('event_id', eventId);

    if (error) {
      console.error('Error fetching convocation:', error);
      return [];
    }
    
    if (!data || data.length === 0) return [];
    
    const playerIds = data.map(c => c.player_id).filter(Boolean);
    let playersMap: Record<string, any> = {};
    let teamPlayersMap: Record<string, any> = {};
    
    if (playerIds.length > 0) {
      const { data: players } = await supabase
        .from('players')
        .select('id, full_name, dorsal, position')
        .in('id', playerIds);
      
      if (players) {
        players.forEach(p => {
          playersMap[p.id] = { 
            full_name: p.full_name, 
            dorsal: p.dorsal,
            position: p.position || 'Jugador'
          };
        });
      }
      
      if (teamId) {
        const { data: teamPlayers } = await supabase
          .from('team_players')
          .select('player_id, shirt_number, position')
          .eq('team_id', teamId)
          .in('player_id', playerIds);
        
        if (teamPlayers) {
          teamPlayers.forEach((tp: any) => {
            teamPlayersMap[tp.player_id] = {
              shirt_number: tp.shirt_number,
              position: tp.position
            };
          });
        }
      }
    }
    
    return data.map(c => ({
      ...c,
      player: playersMap[c.player_id] ? { 
        id: c.player_id, 
        full_name: playersMap[c.player_id].full_name, 
        dorsal: playersMap[c.player_id].dorsal,
        position: playersMap[c.player_id].position,
        club_id: '',
        is_minor: false,
        is_self_managed: false
      } : null,
      teamPlayer: teamPlayersMap[c.player_id] ? {
        shirt_number: teamPlayersMap[c.player_id].shirt_number,
        position: teamPlayersMap[c.player_id].position
      } : null
    }));
  },

  async createConvocation(input: CreateConvocationInput): Promise<Convocation> {
    const { data, error } = await supabase
      .from('convocation')
      .insert([input])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createBulkConvocation(eventId: string, playerIds: string[]): Promise<void> {
    const convocations = playerIds.map(playerId => ({
      event_id: eventId,
      player_id: playerId,
      status: 'pending',
    }));

    const { error } = await supabase
      .from('convocation')
      .insert(convocations);

    if (error) throw error;
  },

  async updateConvocationStatus(convocationId: string, status: 'pending' | 'accepted' | 'declined', note?: string): Promise<Convocation> {
    const { data, error } = await supabase
      .from('convocation')
      .update({ status, response_note: note, updated_at: new Date().toISOString() })
      .eq('id', convocationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteConvocation(convocationId: string): Promise<void> {
    const { error } = await supabase
      .from('convocation')
      .delete()
      .eq('id', convocationId);

    if (error) throw error;
  },
};

export const fieldsApi = {
  async getFields(): Promise<Field[]> {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('fields')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createField(field: Omit<Field, 'id' | 'created_at'>): Promise<Field> {
    const { data, error } = await supabase
      .from('fields')
      .insert([field])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateField(id: string, updates: Partial<Field>): Promise<Field> {
    const { data, error } = await supabase
      .from('fields')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteField(id: string): Promise<void> {
    const { error } = await supabase
      .from('fields')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export const opponentTeamsApi = {
  async getOpponentTeams(): Promise<OpponentTeam[]> {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('opponent_teams')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createOpponentTeam(team: Omit<OpponentTeam, 'id' | 'created_at'>): Promise<OpponentTeam> {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('opponent_teams')
      .insert([{ ...team, club_id: user.club_id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOpponentTeam(id: string, updates: Partial<OpponentTeam>): Promise<OpponentTeam> {
    const { data, error } = await supabase
      .from('opponent_teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteOpponentTeam(id: string): Promise<void> {
    const { error } = await supabase
      .from('opponent_teams')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export const clubsApi = {
  async getClubs(): Promise<Club[]> {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getClub(id: string): Promise<Club | null> {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async createClub(club: Partial<Club>): Promise<Club> {
    const { data, error } = await supabase
      .from('clubs')
      .insert([club])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateClub(id: string, club: Partial<Club>): Promise<Club> {
    const { data, error } = await supabase
      .from('clubs')
      .update(club)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteClub(id: string): Promise<void> {
    const { error } = await supabase
      .from('clubs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export const locationsApi = {
  async getLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching locations:', error);
      return [];
    }
    return data || [];
  },
};
