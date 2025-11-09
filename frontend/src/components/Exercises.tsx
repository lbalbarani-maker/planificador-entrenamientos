import React, { useState, useEffect } from 'react';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Exercise {
  id: string;
  name: string;
  description: string;
  estimatedTime: number;
  categoryId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

const Exercises: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  //const [error] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    estimatedTime: 10,
    categoryId: ''
  });

  // Datos de ejemplo
  useEffect(() => {
    const mockCategories: Category[] = [
      { id: '1', name: 'Calentamiento', color: 'bg-blue-100 text-blue-800' },
      { id: '2', name: 'Resistencia', color: 'bg-green-100 text-green-800' },
      { id: '3', name: 'Fuerza', color: 'bg-red-100 text-red-800' },
      { id: '4', name: 'Velocidad', color: 'bg-yellow-100 text-yellow-800' },
      { id: '5', name: 'Flexibilidad', color: 'bg-purple-100 text-purple-800' }
    ];

    const mockExercises: Exercise[] = [
      {
        id: '1',
        name: 'Calentamiento articular',
        description: 'Rotaciones de tobillos, rodillas, caderas, hombros y cuello',
        estimatedTime: 10,
        categoryId: '1',
        createdBy: '1',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15',
        category: mockCategories[0]
      },
      {
        id: '2',
        name: 'Carrera continua',
        description: 'Trote suave alrededor del campo durante 15 minutos',
        estimatedTime: 15,
        categoryId: '2',
        createdBy: '1',
        createdAt: '2024-01-16',
        updatedAt: '2024-01-16',
        category: mockCategories[1]
      },
      {
        id: '3',
        name: 'Estaciones de fuerza',
        description: 'Circuito con pesas, sentadillas, flexiones y abdominales',
        estimatedTime: 25,
        categoryId: '3',
        createdBy: '1',
        createdAt: '2024-01-17',
        updatedAt: '2024-01-17',
        category: mockCategories[2]
      }
    ];

    setCategories(mockCategories);
    setExercises(mockExercises);
    setLoading(false);
    
    // Seleccionar primera categoría por defecto
    if (mockCategories.length > 0 && !formData.categoryId) {
      setFormData(prev => ({ ...prev, categoryId: mockCategories[0].id }));
    }
  }, [formData.categoryId]);

  // Filtrar ejercicios
  const filteredExercises = exercises.filter(exercise => {
    const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exercise.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || exercise.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Abrir formulario para editar
  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setFormData({
      name: exercise.name,
      description: exercise.description,
      estimatedTime: exercise.estimatedTime,
      categoryId: exercise.categoryId
    });
    setShowForm(true);
  };

  // Resetear formulario
  const resetForm = () => {
    setEditingExercise(null);
    setFormData({
      name: '',
      description: '',
      estimatedTime: 10,
      categoryId: categories.length > 0 ? categories[0].id : ''
    });
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingExercise) {
      // Editar ejercicio existente
      const updatedExercises = exercises.map(ex =>
        ex.id === editingExercise.id
          ? {
              ...ex,
              name: formData.name,
              description: formData.description,
              estimatedTime: formData.estimatedTime,
              categoryId: formData.categoryId,
              updatedAt: new Date().toISOString().split('T')[0],
              category: categories.find(cat => cat.id === formData.categoryId)
            }
          : ex
      );
      setExercises(updatedExercises);
     
    } else {
      // Crear nuevo ejercicio
      const newExercise: Exercise = {
        id: (exercises.length + 1).toString(),
        name: formData.name,
        description: formData.description,
        estimatedTime: formData.estimatedTime,
        categoryId: formData.categoryId,
        createdBy: '1',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        category: categories.find(cat => cat.id === formData.categoryId)
      };
      setExercises([...exercises, newExercise]);
      
    }
    
    resetForm();
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el ejercicio "${name}"?`)) {
      const updatedExercises = exercises.filter(ex => ex.id !== id);
      setExercises(updatedExercises);
     
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
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tiempo estimado (minutos) *</label>
                <input
                  type="number"
                  value={formData.estimatedTime}
                  onChange={(e) => setFormData({ ...formData, estimatedTime: parseInt(e.target.value) || 1 })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                  min="1"
                  max="120"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Categoría *</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                  required
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
                className="bg-sanse-blue text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {editingExercise ? 'Actualizar Ejercicio' : 'Crear Ejercicio'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
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
                      ⏱️ {exercise.estimatedTime} min
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
                    Creado: {new Date(exercise.createdAt).toLocaleDateString()}
                  </span>
                  {exercise.updatedAt !== exercise.createdAt && (
                    <span className="text-sm text-gray-500">
                      Editado: {new Date(exercise.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(exercise)}
                  className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                  title="Editar ejercicio"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(exercise.id, exercise.name)}
                  className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                  title="Eliminar ejercicio"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredExercises.length === 0 && (
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
                {exercises.reduce((total, ex) => total + ex.estimatedTime, 0)}
              </div>
              <div className="text-sm text-gray-600">Minutos totales</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{categories.length}</div>
              <div className="text-sm text-gray-600">Categorías</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {(exercises.reduce((total, ex) => total + ex.estimatedTime, 0) / exercises.length).toFixed(1)}
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