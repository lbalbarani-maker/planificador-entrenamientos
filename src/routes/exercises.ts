import express from 'express';
import { exercises, Exercise } from '../data/exercises';
import { categories } from '../data/categories';

const router = express.Router();

// Interfaz extendida para incluir datos de categoría
interface ExerciseWithCategory extends Exercise {
  category?: any;
}

// GET /api/exercises - Listar todos los ejercicios con datos de categorías
router.get('/', (req, res) => {
  const exercisesWithCategories: ExerciseWithCategory[] = exercises.map(exercise => {
    const category = categories.find(cat => cat.id === exercise.categoryId);
    return {
      ...exercise,
      category: category
    };
  });

  res.json({
    success: true,
    data: exercisesWithCategories
  });
});

// GET /api/exercises/:id - Obtener un ejercicio específico
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const exercise = exercises.find(ex => ex.id === id);
    
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado'
      });
    }

    res.json({
      success: true,
      data: exercise
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener ejercicio'
    });
  }
});

// POST /api/exercises - Crear nuevo ejercicio
router.post('/', (req, res) => {
  try {
    const { name, description, estimatedTime, categoryId } = req.body;
    
    if (!name || !description || !estimatedTime || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    const newExercise: Exercise = {
      id: (exercises.length + 1).toString(),
      name,
      description,
      estimatedTime,
      categoryId,
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    exercises.push(newExercise);

    res.status(201).json({
      success: true,
      message: 'Ejercicio creado exitosamente',
      data: newExercise
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear ejercicio'
    });
  }
});

// PUT /api/exercises/:id - Actualizar ejercicio
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, estimatedTime, categoryId } = req.body;
    
    const exerciseIndex = exercises.findIndex(ex => ex.id === id);
    
    if (exerciseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado'
      });
    }

    exercises[exerciseIndex] = {
      ...exercises[exerciseIndex],
      name,
      description,
      estimatedTime,
      categoryId,
      updatedAt: new Date()
    };

    res.json({
      success: true,
      message: 'Ejercicio actualizado exitosamente',
      data: exercises[exerciseIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar ejercicio'
    });
  }
});

// DELETE /api/exercises/:id - Eliminar ejercicio
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const exerciseIndex = exercises.findIndex(ex => ex.id === id);
    
    if (exerciseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado'
      });
    }

    exercises.splice(exerciseIndex, 1);

    res.json({
      success: true,
      message: 'Ejercicio eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar ejercicio'
    });
  }
});

export default router;