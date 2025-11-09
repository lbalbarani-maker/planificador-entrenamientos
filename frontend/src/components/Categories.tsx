import React, { useState, useEffect } from 'react';
import { categoriesApi, Category } from '../lib/supabaseCategories';
import { exercisesApi } from '../lib/supabaseExercises';

const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('bg-blue-100 text-blue-800');
  const [formLoading, setFormLoading] = useState(false);

  // Colores predefinidos para categorías
  const colorOptions = [
    { value: 'bg-blue-100 text-blue-800', label: 'Azul', preview: '🔵', bgColor: 'bg-blue-500' },
    { value: 'bg-red-100 text-red-800', label: 'Rojo', preview: '🔴', bgColor: 'bg-red-500' },
    { value: 'bg-green-100 text-green-800', label: 'Verde', preview: '🟢', bgColor: 'bg-green-500' },
    { value: 'bg-yellow-100 text-yellow-800', label: 'Amarillo', preview: '🟡', bgColor: 'bg-yellow-500' },
    { value: 'bg-purple-100 text-purple-800', label: 'Morado', preview: '🟣', bgColor: 'bg-purple-500' },
    { value: 'bg-orange-100 text-orange-800', label: 'Naranja', preview: '🟠', bgColor: 'bg-orange-500' },
    { value: 'bg-pink-100 text-pink-800', label: 'Rosa', preview: '🌸', bgColor: 'bg-pink-500' },
    { value: 'bg-indigo-100 text-indigo-800', label: 'Índigo', preview: '🔮', bgColor: 'bg-indigo-500' },
  ];

  // Cargar datos desde Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesData, exercisesData] = await Promise.all([
        categoriesApi.getCategories(),
        exercisesApi.getExercises()
      ]);
      
      setCategories(categoriesData);
      setExercises(exercisesData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Contar ejercicios por categoría
  const getExerciseCount = (categoryId: string) => {
    return exercises.filter(ex => ex.category_id === categoryId).length;
  };

  // Abrir formulario para editar
  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryColor(category.color);
    setShowForm(true);
  };

  // Resetear formulario
  const resetForm = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryColor('bg-blue-100 text-blue-800');
    setShowForm(false);
  };

  // Crear o actualizar categoría
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      alert('El nombre de la categoría es requerido');
      return;
    }

    setFormLoading(true);

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // Verificar si el nombre ya existe (excluyendo la categoría actual)
      const existingCategory = categories.find(cat =>
        cat.id !== editingCategory?.id && cat.name.toLowerCase() === categoryName.toLowerCase()
      );

      if (existingCategory) {
        alert('Ya existe una categoría con ese nombre');
        return;
      }

      if (editingCategory) {
        // Editar categoría existente
        const updatedCategory = await categoriesApi.updateCategory(editingCategory.id, {
          name: categoryName,
          color: categoryColor
        });
        
        setCategories(categories.map(cat => cat.id === editingCategory.id ? updatedCategory : cat));
        alert('Categoría actualizada exitosamente!');
      } else {
        // Crear nueva categoría
        const newCategory = await categoriesApi.createCategory({
          name: categoryName,
          color: categoryColor,
          created_by: user.id
        });
        
        setCategories([...categories, newCategory]);
        alert('Categoría creada exitosamente!');
      }

      resetForm();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error al guardar la categoría');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const exerciseCount = getExerciseCount(id);
    
    if (exerciseCount > 0) {
      alert(`No se puede eliminar la categoría "${name}" porque tiene ${exerciseCount} ejercicio(s) asociado(s).`);
      return;
    }

    if (window.confirm(`¿Estás seguro de eliminar la categoría "${name}"?`)) {
      try {
        await categoriesApi.deleteCategory(id);
        setCategories(categories.filter(cat => cat.id !== id));
        alert('Categoría eliminada exitosamente!');
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Error al eliminar la categoría');
      }
    }
  };

  if (loading) return <div className="text-center p-8">Cargando categorías...</div>;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-sanse-blue">Gestión de Categorías</h1>
          <p className="text-gray-600">Organiza tus ejercicios por categorías y tipos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-sanse-red text-white px-4 py-2 rounded-md hover:bg-red-700"
          disabled={formLoading}
        >
          + Nueva Categoría
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-sanse-blue">{categories.length}</div>
          <div className="text-sm text-gray-600">Total Categorías</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-green-600">
            {exercises.length}
          </div>
          <div className="text-sm text-gray-600">Ejercicios Totales</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-purple-600">
            {categories.length > 0 ? Math.round(exercises.length / categories.length) : 0}
          </div>
          <div className="text-sm text-gray-600">Promedio por Categoría</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-orange-600">
            {categories.filter(cat => getExerciseCount(cat.id) === 0).length}
          </div>
          <div className="text-sm text-gray-600">Categorías Vacías</div>
        </div>
      </div>

      {/* Formulario de creación/edición */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingCategory ? 'Editar Categoría' : 'Crear Nueva Categoría'}
          </h2>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la categoría *
              </label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ej: Calentamiento, Fuerza, Velocidad..."
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                required
                disabled={formLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color de la categoría
              </label>
              <div className="grid grid-cols-4 gap-3">
                {colorOptions.map((colorOption) => (
                  <button
                    key={colorOption.value}
                    type="button"
                    className={`p-4 rounded-lg border-2 transition-all ${
                      categoryColor === colorOption.value
                        ? 'border-sanse-blue ring-2 ring-blue-200 scale-105'
                        : 'border-gray-300 hover:border-gray-400'
                    } ${colorOption.value} flex flex-col items-center justify-center`}
                    onClick={() => setCategoryColor(colorOption.value)}
                    disabled={formLoading}
                  >
                    <span className="text-xl mb-1">{colorOption.preview}</span>
                    <span className="text-xs font-medium">{colorOption.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-sanse-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={formLoading}
              >
                {formLoading ? 'Guardando...' : (editingCategory ? 'Actualizar Categoría' : 'Crear Categoría')}
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

      {/* Lista de categorías */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => {
          const exerciseCount = getExerciseCount(category.id);
          return (
            <div key={category.id} className="bg-white p-4 rounded-lg shadow-md border hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <span className={`inline-block px-3 py-2 rounded-lg text-sm font-semibold ${category.color}`}>
                    {category.name}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(category)}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                    title="Editar categoría"
                    disabled={formLoading}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                    title="Eliminar categoría"
                    disabled={formLoading}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Ejercicios:</span>
                  <span className={`font-semibold ${
                    exerciseCount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {exerciseCount} ejercicio(s)
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Creada:</span>
                  <span className="text-gray-500">
                    {new Date(category.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Barra de progreso para ejercicios */}
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-sanse-blue h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min((exerciseCount / 10) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-center">
                  {exerciseCount}/10 ejercicios
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {categories.length === 0 && !loading && (
        <div className="text-center p-8 text-gray-500 bg-white rounded-lg shadow-md">
          No hay categorías creadas. ¡Crea la primera!
        </div>
      )}

      {/* Información de uso */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-sanse-blue mb-2">💡 Tip de organización</h3>
        <p className="text-sm text-blue-700">
          Agrupa tus ejercicios en categorías lógicas como: Calentamiento, Fuerza Superior, Fuerza Inferior, 
          Cardio, Flexibilidad, etc. Esto te ayudará a crear entrenamientos más equilibrados.
        </p>
      </div>
    </div>
  );
};

export default Categories;