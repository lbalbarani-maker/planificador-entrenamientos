import { supabase } from './supabase';
import {
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
} from '../types/teams';

const getCurrentUser = async () => {
  const userData = localStorage.getItem('user');
  if (!userData) throw new Error('Usuario no autenticado');
  return JSON.parse(userData);
};

export const teamsApi = {
  async getTeams(): Promise<Team[]> {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
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

  async createPlayer(fullName: string, birthDate?: string): Promise<Player> {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('players')
      .insert([
        {
          club_id: user.club_id,
          full_name: fullName,
          birth_date: birthDate,
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
    const { data, error } = await supabase
      .from('team_players')
      .select('*, player:players(*)')
      .eq('team_id', teamId)
      .order('shirt_number', { ascending: true });

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
      .select('*, team:teams(*)')
      .order('start_datetime', { ascending: true });

    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getUpcomingEvents(limit: number = 10): Promise<Event[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('events')
      .select('*, team:teams(*)')
      .gte('start_datetime', now)
      .order('start_datetime', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async createEvent(input: CreateEventInput): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .insert([input])
      .select()
      .single();

    if (error) throw error;
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
};

export const convocationApi = {
  async getConvocation(eventId: string): Promise<Convocation[]> {
    const { data, error } = await supabase
      .from('convocation')
      .select('*, player:players(*)')
      .eq('event_id', eventId)
      .order('player.full_name', { ascending: true });

    if (error) throw error;
    return data || [];
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
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('fields')
      .insert([{ ...field, club_id: user.club_id }])
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
