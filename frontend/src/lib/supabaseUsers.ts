import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
  full_name: string;
  password: string;
  role: 'admin' | 'preparador';
  is_active: boolean;
  created_at: string;
}

export const usersApi = {
  // Obtener todos los usuarios
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
    return data || [];
  },

  // Crear usuario
  async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert([user])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      throw error;
    }
    return data;
  },

  // Actualizar usuario
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
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

  // Eliminar usuario
  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // Buscar usuario por email y password (para login)
  async loginUser(email: string, password: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('Login error:', error);
      return null;
    }
    return data;
  }
};