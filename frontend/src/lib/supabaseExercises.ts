import { supabase } from './supabase';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  estimated_time: number;
  category_id: string;
  created_by: string;
  created_at: string;
  category?: {
    id: string;
    name: string;
    color: string;
  };
}

export const exercisesApi = {
  // Obtener todos los ejercicios con información de categoría
  async getExercises(): Promise<Exercise[]> {
    const { data, error } = await supabase
      .from('exercises')
      .select(`
        *,
        category:categories (
          id,
          name,
          color
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching exercises:', error);
      throw error;
    }
    return data || [];
  },

  // Crear ejercicio
  async createExercise(exercise: Omit<Exercise, 'id' | 'created_at' | 'category'>): Promise<Exercise> {
    const { data, error } = await supabase
      .from('exercises')
      .insert([exercise])
      .select(`
        *,
        category:categories (
          id,
          name,
          color
        )
      `)
      .single();
    
    if (error) {
      console.error('Error creating exercise:', error);
      throw error;
    }
    return data;
  },

  // Actualizar ejercicio
  async updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise> {
    const { data, error } = await supabase
      .from('exercises')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        category:categories (
          id,
          name,
          color
        )
      `)
      .single();
    
    if (error) {
      console.error('Error updating exercise:', error);
      throw error;
    }
    return data;
  },

  // Eliminar ejercicio
  async deleteExercise(id: string): Promise<void> {
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting exercise:', error);
      throw error;
    }
  }
};