import express from 'express';
import { categories, Category } from '../data/categories';
import { exercises } from '../data/exercises';

const router = express.Router();

// GET /api/categories - Listar todas las categorías
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: categories
  });
});

// GET /api/categories/:id - Obtener una categoría específica
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const category = categories.find(cat => cat.id === id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener categoría'
    });
  }
});

// POST /api/categories - Crear nueva categoría
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es requerido'
      });
    }

    const existingCategory = categories.find(cat => 
      cat.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre'
      });
    }

    const newCategory: Category = {
      id: (categories.length + 1).toString(),
      name,
      color: color || 'bg-gray-100 text-gray-800',
      createdBy: '1',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    categories.push(newCategory);

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: newCategory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear categoría'
    });
  }
});

// PUT /api/categories/:id - Actualizar categoría
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es requerido'
      });
    }

    const categoryIndex = categories.findIndex(cat => cat.id === id);
    
    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    const existingCategory = categories.find(cat => 
      cat.id !== id && cat.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe otra categoría con ese nombre'
      });
    }

    categories[categoryIndex] = {
      ...categories[categoryIndex],
      name,
      color: color || categories[categoryIndex].color,
      updatedAt: new Date()
    };

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: categories[categoryIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar categoría'
    });
  }
});

// DELETE /api/categories/:id - Eliminar categoría
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const exercisesUsingCategory = exercises.filter(ex => ex.categoryId === id);
    
    if (exercisesUsingCategory.length > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar. Hay ${exercisesUsingCategory.length} ejercicio(s) usando esta categoría`
      });
    }

    const categoryIndex = categories.findIndex(cat => cat.id === id);
    
    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    categories.splice(categoryIndex, 1);

    res.json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar categoría'
    });
  }
});

export default router;