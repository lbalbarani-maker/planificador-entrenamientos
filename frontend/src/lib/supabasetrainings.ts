import { supabase } from './supabase';

// Definimos los tipos aquí para evitar dependencias externas
export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  estimatedTime: number;
  categoryId: string;
  category?: Category;
}

export interface TrainingExercise {
  exerciseId: string;
  customTime?: number;
  order: number;
  exercise?: Exercise;
}

export interface Training {
  id: string;
  name: string;
  categories: string[];
  exercises: TrainingExercise[];
  totalTime: number;
  observations: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  shareId: string;
}

// Función helper para obtener el usuario actual (sistema custom)
const getCurrentUser = async () => {
  try {
    // Obtener usuario desde localStorage en lugar de Supabase Auth
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

export const getTrainings = async (): Promise<Training[]> => {
  try {
    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from('trainings')
      .select(`
        *,
        training_exercises (
          *,
          exercises (
            *,
            categories (*)
          )
        )
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trainings:', error);
      throw error;
    }

    if (!data) return [];

    return data.map(training => {
      const exercises: TrainingExercise[] = (training.training_exercises || []).map((te: any) => ({
        exerciseId: te.exercise_id,
        customTime: te.custom_time,
        order: te.exercise_order,
        exercise: te.exercises ? {
          id: te.exercises.id,
          name: te.exercises.name,
          description: te.exercises.description || '',
          estimatedTime: te.exercises.estimated_time || 0,
          categoryId: te.exercises.category_id,
          category: te.exercises.categories ? {
            id: te.exercises.categories.id,
            name: te.exercises.categories.name,
            color: te.exercises.categories.color || 'bg-gray-100 text-gray-800'
          } : undefined
        } : undefined
      }));

      exercises.sort((a, b) => a.order - b.order);

      return {
        id: training.id,
        name: training.name,
        categories: training.categories || [],
        exercises: exercises,
        totalTime: training.total_time || 0,
        observations: training.observations || '',
        createdBy: training.created_by || '',
        createdAt: training.created_at,
        updatedAt: training.updated_at,
        shareId: training.share_id || ''
      };
    });

  } catch (error) {
    console.error('Error in getTrainings:', error);
    throw error;
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

// Función para generar un ShareId único
const generateShareId = (): string => {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
};
export const createTraining = async (trainingData: {
  name: string;
  categories: string[];
  exercises: TrainingExercise[];
  totalTime: number;
  observations: string;
}): Promise<Training> => {
  try {
    const user = await getCurrentUser();

    console.log('Creating training for user:', user.id);

    // Generar ShareId único
    const shareId = generateShareId();

    // 1. Crear el entrenamiento principal
    const { data: training, error: trainingError } = await supabase
      .from('trainings')
      .insert([
        {
          name: trainingData.name,
          categories: trainingData.categories,
          observations: trainingData.observations,
          total_time: trainingData.totalTime,
          created_by: user.id,
          share_id: shareId, // <- Agregar el ShareId generado
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (trainingError) {
      console.error('Supabase error creating training:', trainingError);
      throw trainingError;
    }

    if (!training) {
      throw new Error('No data returned from Supabase for training');
    }

    // 2. Crear los training_exercises
    if (trainingData.exercises && trainingData.exercises.length > 0) {
      const trainingExercises = trainingData.exercises.map((exercise: TrainingExercise, index: number) => ({
        training_id: training.id,
        exercise_id: exercise.exerciseId,
        custom_time: exercise.customTime,
        exercise_order: exercise.order || index + 1
      }));

      const { error: exercisesError } = await supabase
        .from('training_exercises')
        .insert(trainingExercises);

      if (exercisesError) {
        console.error('Supabase error creating training exercises:', exercisesError);
        throw exercisesError;
      }
    }

    console.log('Training created successfully:', training);

    // 3. Retornar el training completo
    return {
      id: training.id,
      name: training.name,
      categories: training.categories || [],
      exercises: trainingData.exercises || [],
      totalTime: training.total_time || 0,
      observations: training.observations || '',
      createdBy: training.created_by || '',
      createdAt: training.created_at,
      updatedAt: training.updated_at,
      shareId: training.share_id || ''
    };

  } catch (error) {
    console.error('Error in createTraining:', error);
    throw error;
  }
};

// ... (las otras funciones updateTraining y deleteTraining permanecen igual)
export const updateTraining = async (id: string, trainingData: {
  name: string;
  categories: string[];
  exercises: TrainingExercise[];
  totalTime: number;
  observations: string;
}): Promise<Training> => {
  try {
    const user = await getCurrentUser();

    console.log('Updating training:', id, 'for user:', user.id);

    // 1. Verificar que el training pertenece al usuario actual
    const { data: existingTraining, error: fetchError } = await supabase
      .from('trainings')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching training:', fetchError);
      throw fetchError;
    }

    if (existingTraining.created_by !== user.id) {
      throw new Error('No tienes permisos para editar este entrenamiento');
    }

    // 2. Actualizar el entrenamiento principal
    const { data: training, error: trainingError } = await supabase
      .from('trainings')
      .update({
        name: trainingData.name,
        categories: trainingData.categories,
        observations: trainingData.observations,
        total_time: trainingData.totalTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (trainingError) {
      console.error('Supabase error updating training:', trainingError);
      throw trainingError;
    }

    if (!training) {
      throw new Error('No data returned from Supabase for training');
    }

    // 3. Eliminar training_exercises existentes
    const { error: deleteError } = await supabase
      .from('training_exercises')
      .delete()
      .eq('training_id', id);

    if (deleteError) {
      console.error('Supabase error deleting training exercises:', deleteError);
      throw deleteError;
    }

    // 4. Crear nuevos training_exercises
    if (trainingData.exercises && trainingData.exercises.length > 0) {
      const trainingExercises = trainingData.exercises.map((exercise: TrainingExercise, index: number) => ({
        training_id: id,
        exercise_id: exercise.exerciseId,
        custom_time: exercise.customTime,
        exercise_order: exercise.order || index + 1
      }));

      const { error: exercisesError } = await supabase
        .from('training_exercises')
        .insert(trainingExercises);

      if (exercisesError) {
        console.error('Supabase error creating training exercises:', exercisesError);
        throw exercisesError;
      }
    }

    console.log('Training updated successfully:', training);

    return {
      id: training.id,
      name: training.name,
      categories: training.categories || [],
      exercises: trainingData.exercises || [],
      totalTime: training.total_time || 0,
      observations: training.observations || '',
      createdBy: training.created_by || '',
      createdAt: training.created_at,
      updatedAt: training.updated_at,
      shareId: training.share_id || ''
    };

  } catch (error) {
    console.error('Error in updateTraining:', error);
    throw error;
  }
};

export const deleteTraining = async (id: string): Promise<void> => {
  try {
    const user = await getCurrentUser();

    // 1. Verificar que el training pertenece al usuario actual
    const { data: existingTraining, error: fetchError } = await supabase
      .from('trainings')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching training:', fetchError);
      throw fetchError;
    }

    if (existingTraining.created_by !== user.id) {
      throw new Error('No tienes permisos para eliminar este entrenamiento');
    }

    // 2. Primero eliminar training_exercises
    const { error: exercisesError } = await supabase
      .from('training_exercises')
      .delete()
      .eq('training_id', id);

    if (exercisesError) {
      console.error('Supabase error deleting training exercises:', exercisesError);
      throw exercisesError;
    }

    // 3. Luego eliminar el training
    const { error: trainingError } = await supabase
      .from('trainings')
      .delete()
      .eq('id', id);

    if (trainingError) {
      console.error('Supabase error deleting training:', trainingError);
      throw trainingError;
    }

    console.log('Training deleted successfully');

  } catch (error) {
    console.error('Error in deleteTraining:', error);
    throw error;
  }
};