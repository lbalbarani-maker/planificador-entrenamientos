import { supabase } from './supabase';
import { Training, Exercise, Category } from '../types/training';

export const getTrainings = async (): Promise<Training[]> => {
  try {
    const { data, error } = await supabase
      .from('trainings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trainings:', error);
      throw error;
    }

    if (!data) return [];

    return data.map(training => ({
      id: training.id,
      name: training.name,
      categories: training.categories || [],
      exercises: training.exercises || [],
      totalTime: training.total_time || 0,
      observations: training.observations || '',
      createdBy: training.created_by || '',
      createdAt: training.created_at,
      updatedAt: training.updated_at,
      shareId: training.share_id || ''
    }));
  } catch (error) {
    console.error('Error in getTrainings:', error);
    return [];
  }
};

export const getExercises = async (): Promise<Exercise[]> => {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('*, categories(*)')
      .order('name');

    if (error) {
      console.error('Error fetching exercises:', error);
      throw error;
    }

    if (!data) return [];

    return data.map(exercise => ({
      id: exercise.id,
      name: exercise.name,
      description: exercise.description || '',
      estimatedTime: exercise.estimated_time || 0,
      categoryId: exercise.category_id,
      category: exercise.categories ? {
        id: exercise.categories.id,
        name: exercise.categories.name,
        color: exercise.categories.color || 'bg-gray-100 text-gray-800'
      } : undefined
    }));
  } catch (error) {
    console.error('Error in getExercises:', error);
    return [];
  }
};

export const getCategories = async (): Promise<Category[]> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }

    if (!data) return [];

    return data.map(category => ({
      id: category.id,
      name: category.name,
      color: category.color || 'bg-gray-100 text-gray-800'
    }));
  } catch (error) {
    console.error('Error in getCategories:', error);
    return [];
  }
};

export const createTraining = async (trainingData: any): Promise<Training> => {
  try {
    console.log('Creating training with data:', trainingData);
    
    const { data, error } = await supabase
      .from('trainings')
      .insert([
        {
          name: trainingData.name,
          categories: trainingData.categories,
          exercises: trainingData.exercises,
          total_time: trainingData.total_time,
          observations: trainingData.observations,
          created_by: trainingData.created_by
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating training:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from Supabase');
    }

    console.log('Training created successfully:', data);

    return {
      id: data.id,
      name: data.name,
      categories: data.categories || [],
      exercises: data.exercises || [],
      totalTime: data.total_time || 0,
      observations: data.observations || '',
      createdBy: data.created_by || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      shareId: data.share_id || ''
    };
  } catch (error) {
    console.error('Error in createTraining:', error);
    throw error;
  }
};

export const updateTraining = async (id: string, trainingData: any): Promise<Training> => {
  try {
    console.log('Updating training:', id, 'with data:', trainingData);
    
    const { data, error } = await supabase
      .from('trainings')
      .update({
        name: trainingData.name,
        categories: trainingData.categories,
        exercises: trainingData.exercises,
        total_time: trainingData.total_time,
        observations: trainingData.observations,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating training:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from Supabase');
    }

    console.log('Training updated successfully:', data);

    return {
      id: data.id,
      name: data.name,
      categories: data.categories || [],
      exercises: data.exercises || [],
      totalTime: data.total_time || 0,
      observations: data.observations || '',
      createdBy: data.created_by || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      shareId: data.share_id || ''
    };
  } catch (error) {
    console.error('Error in updateTraining:', error);
    throw error;
  }
};

export const deleteTraining = async (id: string): Promise<void> => {
  try {
    console.log('Deleting training:', id);
    
    const { error } = await supabase
      .from('trainings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error deleting training:', error);
      throw error;
    }

    console.log('Training deleted successfully');
  } catch (error) {
    console.error('Error in deleteTraining:', error);
    throw error;
  }
};