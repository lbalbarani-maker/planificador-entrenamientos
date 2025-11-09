import React, { useState, useEffect } from 'react';
import { exercisesApi, Exercise } from '../lib/supabaseExercises';
import { categoriesApi, Category } from '../lib/supabaseCategories';

const Exercises: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    estimated_time: 10,
    category_id: ''
  });

  // Cargar datos desde Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      const [exercisesData, categoriesData] = await Promise.all([
        exercisesApi.getExercises(),
        categoriesApi.getCategories()
      ]);
      
      setExercises(exercisesData);
      setCategories(categoriesData);
      
      // Seleccionar primera categoría por defecto si no hay una seleccionada
      if (categoriesData.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: categoriesData[0].id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };
useEffect(() => {
  loadData();
}, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtrar ejercicios
  const filteredExercises = exercises.filter(exercise => {
    const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exercise.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || exercise.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Abrir formulario para editar
  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setFormData({
      name: exercise.name,
      description: exercise.description,
      estimated_time: exercise.estimated_time,
      category_id: exercise.category_id
    });
    setShowForm(true);
  };

  // Resetear formulario
  const resetForm = () => {
    setEditingExercise(null);
    setFormData({
      name: '',
      description: '',
      estimated_time: 10,
      category_id: categories.length > 0 ? categories[0].id : ''
    });
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (editingExercise) {
        // Editar ejercicio existente
        const updatedExercise = await exercisesApi.updateExercise(editingExercise.id, {
          name: formData.name,
          description: formData.description,
          estimated_time: formData.estimated_time,
          category_id: formData.category_id
        });
        
        setExercises(exercises.map(ex => ex.id === editingExercise.id ? updatedExercise : ex));
        alert('Ejercicio actualizado exitosamente!');
      } else {
        // Crear nuevo ejercicio
        const newExercise = await exercisesApi.createExercise({
          name: formData.name,
          description: formData.description,
          estimated_time: formData.estimated_time,
          category_id: formData.category_id,
          created_by: user.id
        });
        
        setExercises([...exercises, newExercise]);
        alert('Ejercicio creado exitosamente!');
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving exercise:', error);
      alert('Error al guardar el ejercicio');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el ejercicio "${name}"?`)) {
      try {
        await exercisesApi.deleteExercise(id);
        setExercises(exercises.filter(ex => ex.id !== id));
        alert('Ejercicio eliminado exitosamente!');
      } catch (error) {
        console.error('Error deleting exercise:', error);
        alert('Error al eliminar el ejercicio');
      }
    }
  };

  if (loading) return <div className="text-center p-8">Cargando ejercicios...</div>;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-sanse-blue">Gestión de Ejercicios</h1>
          <p className="text-gray-600">Crea y organiza los ejercicios para tus entrenamientos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-sanse-red text-white px-4 py-2 rounded-md hover:bg-red-700"
          disabled={formLoading}
        >
          + Nuevo Ejercicio
        </button>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar ejercicio</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o descripción..."
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por categoría</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Formulario de creación/edición */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingExercise ? 'Editar Ejercicio' : 'Crear Nuevo Ejercicio'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del ejercicio *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                placeholder="Ej: Sentadillas, Flexiones, Carrera..."
                required
                disabled={formLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Descripción *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                rows={3}
                placeholder="Describe cómo realizar el ejercicio, técnicas, precauciones..."
                required
                disabled={formLoading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tiempo estimado (minutos) *</label>
                <input
                  type="number"
                  value={formData.estimated_time}
                  onChange={(e) => setFormData({ ...formData, estimated_time: parseInt(e.target.value) || 1 })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                  min="1"
                  max="120"
                  required
                  disabled={formLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Categoría *</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                  required
                  disabled={formLoading}
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-sanse-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={formLoading}
              >
                {formLoading ? 'Guardando...' : (editingExercise ? 'Actualizar Ejercicio' : 'Crear Ejercicio')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50"
                disabled={formLoading}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de ejercicios */}
      <div className="grid gap-4">
        {filteredExercises.map((exercise) => (
          <div key={exercise.id} className="bg-white p-4 rounded-lg shadow-md border hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-sanse-blue">{exercise.name}</h3>
                    <p className="text-gray-600 mt-1">{exercise.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="bg-sanse-blue text-white px-2 py-1 rounded-full text-sm font-medium">
                      ⏱️ {exercise.estimated_time} min
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mt-3">
                  {exercise.category && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${exercise.category.color}`}>
                      {exercise.category.name}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">
                    Creado: {new Date(exercise.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(exercise)}
                  className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                  title="Editar ejercicio"
                  disabled={formLoading}
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(exercise.id, exercise.name)}
                  className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                  title="Eliminar ejercicio"
                  disabled={formLoading}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredExercises.length === 0 && !loading && (
        <div className="text-center p-8 text-gray-500 bg-white rounded-lg shadow-md">
          {searchTerm || selectedCategory !== 'all' 
            ? 'No se encontraron ejercicios con los filtros aplicados.'
            : 'No hay ejercicios creados. ¡Crea el primero!'
          }
        </div>
      )}

      {/* Estadísticas */}
      {exercises.length > 0 && (
        <div className="mt-6 bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-sanse-blue mb-3">Estadísticas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-sanse-blue">{exercises.length}</div>
              <div className="text-sm text-gray-600">Total ejercicios</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {exercises.reduce((total, ex) => total + ex.estimated_time, 0)}
              </div>
              <div className="text-sm text-gray-600">Minutos totales</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{categories.length}</div>
              <div className="text-sm text-gray-600">Categorías</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {exercises.length > 0 ? (exercises.reduce((total, ex) => total + ex.estimated_time, 0) / exercises.length).toFixed(1) : '0'}
              </div>
              <div className="text-sm text-gray-600">Promedio minutos</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exercises;