import { supabase } from './supabase';

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  club_id: string | null;
  is_super_admin: boolean;
  is_club_admin: boolean;
  pin?: string;
  password?: string;
}

export interface UserRelation {
  id: string;
  user_id: string;
  relation_type: 'player' | 'team';
  relation_id: string;
  created_at: string;
}

export const usersApi = {
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
    return data || [];
  },

  async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const userWithHash = {
      ...user,
      password: user.password ? simpleHash(user.password) : simpleHash('default123')
    };
    const { data, error } = await supabase
      .from('profiles')
      .insert([userWithHash])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      throw error;
    }
    return data;
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user:', error);
      throw error;
    }
    return data;
  },

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  async loginUser(email: string, password: string): Promise<User | null> {
    const passwordHash = simpleHash(password);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      console.error('Login error:', error);
      return null;
    }

    if (data.password === passwordHash || data.password === password) {
      return data;
    }
    return null;
  },

  async loginWithPin(email: string, pin: string): Promise<User | null> {
    const pinHash = simpleHash(pin);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .eq('pin', pinHash)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      console.error('Login with PIN error:', error);
      return null;
    }
    return data;
  },

  // === RELACIONES ===
  async getUserRelations(userId: string): Promise<UserRelation[]> {
    const { data, error } = await supabase
      .from('user_relations')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user relations:', error);
      throw error;
    }
    return data || [];
  },

  async linkUserToPlayer(userId: string, playerId: string): Promise<UserRelation> {
    const { data, error } = await supabase
      .from('user_relations')
      .insert([{
        user_id: userId,
        relation_type: 'player',
        relation_id: playerId
      }])
      .select()
      .single();

    if (error) {
      console.error('Error linking user to player:', error);
      throw error;
    }
    return data;
  },

  async linkUserToTeam(userId: string, teamId: string): Promise<UserRelation> {
    const { data, error } = await supabase
      .from('user_relations')
      .insert([{
        user_id: userId,
        relation_type: 'team',
        relation_id: teamId
      }])
      .select()
      .single();

    if (error) {
      console.error('Error linking user to team:', error);
      throw error;
    }
    return data;
  },

  async unlinkRelation(relationId: string): Promise<void> {
    const { error } = await supabase
      .from('user_relations')
      .delete()
      .eq('id', relationId);

    if (error) {
      console.error('Error unlinking relation:', error);
      throw error;
    }
  },

  async updateUserRelations(userId: string, playerIds: string[], teamIds: string[]): Promise<void> {
    // Eliminar relaciones existentes
    const { error: deleteError } = await supabase
      .from('user_relations')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting old relations:', deleteError);
      throw deleteError;
    }

    // Crear nuevas relaciones de jugadores
    if (playerIds.length > 0) {
      const playerRelations = playerIds.map(playerId => ({
        user_id: userId,
        relation_type: 'player' as const,
        relation_id: playerId
      }));

      const { error: playerError } = await supabase
        .from('user_relations')
        .insert(playerRelations);

      if (playerError) {
        console.error('Error creating player relations:', playerError);
        throw playerError;
      }
    }

    // Crear nuevas relaciones de equipos
    if (teamIds.length > 0) {
      const teamRelations = teamIds.map(teamId => ({
        user_id: userId,
        relation_type: 'team' as const,
        relation_id: teamId
      }));

      const { error: teamError } = await supabase
        .from('user_relations')
        .insert(teamRelations);

      if (teamError) {
        console.error('Error creating team relations:', teamError);
        throw teamError;
      }
    }
  }
};