import { supabase } from './supabase';
import { Training, Exercise, Category, TrainingExercise } from '../types/training';

// Obtener todos los entrenamientos del usuario actual
export const getTrainings = async (): Promise<Training[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase
    .from('trainings')
    .select('*')
    .eq('created_by', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  
  // Convertir de snake_case a camelCase
  return data.map(training => ({
    id: training.id,
    name: training.name,
    categories: training.categories || [],
    exercises: (training.exercises || []).map((ex: any) => ({
      exerciseId: ex.exercise_id,
      customTime: ex.custom_time,
      order: ex.order,
      exercise: ex.exercise
    })),
    totalTime: training.total_time,
    observations: training.observations,
    createdBy: training.created_by,
    createdAt: training.created_at,
    updatedAt: training.updated_at,
    shareId: training.share_id
  }));
};

// Obtener todos los ejercicios
export const getExercises = async (): Promise<Exercise[]> => {
  const { data, error } = await supabase
    .from('exercises')
    .select(`
      *,
      category:categories(*)
    `)
    .order('name');

  if (error) throw error;
  
  // Convertir de snake_case a camelCase
  return data.map(exercise => ({
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    estimatedTime: exercise.estimated_time,
    categoryId: exercise.category_id,
    createdBy: exercise.created_by,
    createdAt: exercise.created_at,
    category: exercise.category ? {
      id: exercise.category.id,
      name: exercise.category.name,
      color: exercise.category.color,
      createdAt: exercise.category.created_at
    } : undefined
  }));
};

// Obtener todas las categorías
export const getCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) throw error;
  
  // Convertir de snake_case a camelCase
  return data.map(category => ({
    id: category.id,
    name: category.name,
    color: category.color,
    createdAt: category.created_at
  }));
};

// Crear nuevo entrenamiento
export const createTraining = async (training: Omit<Training, 'id' | 'createdAt' | 'updatedAt' | 'shareId'>): Promise<Training> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const shareId = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  // Convertir de camelCase a snake_case para la base de datos
  const { data, error } = await supabase
    .from('trainings')
    .insert([
      {
        name: training.name,
        categories: training.categories,
        exercises: training.exercises.map(ex => ({
          exercise_id: ex.exerciseId,
          custom_time: ex.customTime,
          order: ex.order,
          exercise: ex.exercise
        })),
        total_time: training.totalTime,
        observations: training.observations,
        created_by: user.id,
        share_id: shareId
      }
    ])
    .select()
    .single();

  if (error) throw error;

  // Convertir de snake_case a camelCase para la respuesta
  return {
    id: data.id,
    name: data.name,
    categories: data.categories || [],
    exercises: (data.exercises || []).map((ex: any) => ({
      exerciseId: ex.exercise_id,
      customTime: ex.custom_time,
      order: ex.order,
      exercise: ex.exercise
    })),
    totalTime: data.total_time,
    observations: data.observations,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    shareId: data.share_id
  };
};

// Actualizar entrenamiento existente
export const updateTraining = async (id: string, training: Partial<Training>): Promise<Training> => {
  // Convertir de camelCase a snake_case para la base de datos
  const updateData: any = {
    name: training.name,
    categories: training.categories,
    observations: training.observations,
    updated_at: new Date().toISOString()
  };

  if (training.exercises) {
    updateData.exercises = training.exercises.map(ex => ({
      exercise_id: ex.exerciseId,
      custom_time: ex.customTime,
      order: ex.order,
      exercise: ex.exercise
    }));
  }

  if (training.totalTime !== undefined) {
    updateData.total_time = training.totalTime;
  }

  const { data, error } = await supabase
    .from('trainings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Convertir de snake_case a camelCase para la respuesta
  return {
    id: data.id,
    name: data.name,
    categories: data.categories || [],
    exercises: (data.exercises || []).map((ex: any) => ({
      exerciseId: ex.exercise_id,
      customTime: ex.custom_time,
      order: ex.order,
      exercise: ex.exercise
    })),
    totalTime: data.total_time,
    observations: data.observations,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    shareId: data.share_id
  };
};

// Eliminar entrenamiento
export const deleteTraining = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('trainings')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// Obtener entrenamiento por share_id (para compartir)
export const getTrainingByShareId = async (shareId: string): Promise<Training> => {
  const { data, error } = await supabase
    .from('trainings')
    .select(`
      *,
      user:profiles(full_name)
    `)
    .eq('share_id', shareId)
    .single();

  if (error) throw error;

  // Convertir de snake_case a camelCase para la respuesta
  return {
    id: data.id,
    name: data.name,
    categories: data.categories || [],
    exercises: (data.exercises || []).map((ex: any) => ({
      exerciseId: ex.exercise_id,
      customTime: ex.custom_time,
      order: ex.order,
      exercise: ex.exercise
    })),
    totalTime: data.total_time,
    observations: data.observations,
    createdBy: data.user?.full_name || 'Usuario',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    shareId: data.share_id
  };
};