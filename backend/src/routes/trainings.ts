// CONTENIDO COMPLETO DEL ARCHIVO - PEGAR TODO
import express from 'express';
import { trainings, Training, TrainingExercise } from '../data/trainings';
import { exercises } from '../data/exercises';
import { categories } from '../data/categories';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET /api/trainings - Listar todos los entrenamientos del usuario
router.get('/', (req, res) => {
  const trainingsWithDetails = trainings.map(training => {
    const trainingExercises = training.exercises.map(te => {
      const exercise = exercises.find(ex => ex.id === te.exerciseId);
      const category = categories.find(cat => cat.id === exercise?.categoryId);
      
      return {
        ...te,
        exercise: {
          ...exercise,
          category
        }
      };
    });

    const trainingCategories = training.categories.map(catId => 
      categories.find(cat => cat.id === catId)
    ).filter(Boolean);

    return {
      ...training,
      exercises: trainingExercises,
      categories: trainingCategories
    };
  });

  res.json({
    success: true,
    data: trainingsWithDetails
  });
});

// GET /api/trainings/shared/:shareId - Obtener entrenamiento por shareId (público)
router.get('/shared/:shareId', (req, res) => {
  const { shareId } = req.params;
  
  const training = trainings.find(t => t.shareId === shareId);
  if (!training) {
    return res.status(404).json({
      success: false,
      message: 'Entrenamiento no encontrado'
    });
  }

  const trainingExercises = training.exercises.map(te => {
    const exercise = exercises.find(ex => ex.id === te.exerciseId);
    const category = categories.find(cat => cat.id === exercise?.categoryId);
    
    return {
      ...te,
      exercise: {
        ...exercise,
        category
      }
    };
  });

  const trainingCategories = training.categories.map(catId => 
    categories.find(cat => cat.id === catId)
  ).filter(Boolean);

  res.json({
    success: true,
    data: {
      ...training,
      exercises: trainingExercises,
      categories: trainingCategories
    }
  });
});

// POST /api/trainings - Crear nuevo entrenamiento
router.post('/', (req, res) => {
  try {
    const { name, categories: trainingCategories, exercises: trainingExercises, observations } = req.body;
    
    if (!name || !trainingCategories || !trainingExercises) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, categorías y ejercicios son requeridos'
      });
    }

    const totalTime = trainingExercises.reduce((total: number, te: TrainingExercise) => 
      total + te.customTime, 0
    );

    const newTraining: Training = {
      id: (trainings.length + 1).toString(),
      name,
      categories: trainingCategories,
      exercises: trainingExercises,
      totalTime,
      observations: observations || '',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      shareId: uuidv4().substring(0, 8)
    };

    trainings.push(newTraining);

    res.status(201).json({
      success: true,
      message: 'Entrenamiento creado exitosamente',
      data: newTraining
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear entrenamiento'
    });
  }
});

// PUT /api/trainings/:id - Actualizar entrenamiento
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, categories: trainingCategories, exercises: trainingExercises, observations } = req.body;
    
    if (!name || !trainingCategories || !trainingExercises) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, categorías y ejercicios son requeridos'
      });
    }

    const trainingIndex = trainings.findIndex(t => t.id === id);
    
    if (trainingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Entrenamiento no encontrado'
      });
    }

    // Calcular nuevo tiempo total
    const totalTime = trainingExercises.reduce((total: number, te: TrainingExercise) => 
      total + te.customTime, 0
    );

    // Actualizar entrenamiento
    trainings[trainingIndex] = {
      ...trainings[trainingIndex],
      name,
      categories: trainingCategories,
      exercises: trainingExercises,
      totalTime,
      observations: observations || '',
      updatedAt: new Date()
    };

    res.json({
      success: true,
      message: 'Entrenamiento actualizado exitosamente',
      data: trainings[trainingIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar entrenamiento'
    });
  }
});

// DELETE /api/trainings/:id - Eliminar entrenamiento
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const trainingIndex = trainings.findIndex(t => t.id === id);
    
    if (trainingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Entrenamiento no encontrado'
      });
    }

    trainings.splice(trainingIndex, 1);

    res.json({
      success: true,
      message: 'Entrenamiento eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar entrenamiento'
    });
  }
});

export default router;