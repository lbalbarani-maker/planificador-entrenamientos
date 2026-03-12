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
  }
};