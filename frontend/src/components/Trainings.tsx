import React, { useState, useEffect } from 'react';
import { 
  Training, 
  Exercise, 
  Category, 
  TrainingExercise,
  getTrainings, 
  getExercises, 
  getCategories, 
  createTraining, 
  updateTraining, 
  deleteTraining 
} from '../lib/supabasetrainings';

const Trainings: React.FC = () => {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  // Estados para el formulario de entrenamiento
  const [showForm, setShowForm] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    categories: [] as string[],
    observations: ''
  });

  // Estado para el "carrito" de ejercicios
  const [cartExercises, setCartExercises] = useState<TrainingExercise[]>([]);
  const [totalTime, setTotalTime] = useState(0);

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [trainingsData, exercisesData, categoriesData] = await Promise.all([
          getTrainings(),
          getExercises(),
          getCategories()
        ]);
        setTrainings(trainingsData || []);
        setExercises(exercisesData || []);
        setCategories(categoriesData || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Efecto para actualizar tiempo total cuando cambia el carrito
  useEffect(() => {
    const total = cartExercises.reduce((sum: number, item: TrainingExercise) => 
      sum + (item.customTime || 0), 0);
    setTotalTime(total);
  }, [cartExercises]);

  // Agregar ejercicio al carrito
  const addToCart = (exercise: Exercise) => {
    const existingItem = cartExercises.find(item => item.exerciseId === exercise.id);
    
    if (existingItem) {
      const updatedCart = cartExercises.map(item =>
        item.exerciseId === exercise.id
          ? { ...item, customTime: (item.customTime || 0) + 5 }
          : item
      );
      setCartExercises(updatedCart);
    } else {
      const newItem: TrainingExercise = {
        exerciseId: exercise.id,
        customTime: exercise.estimatedTime,
        order: cartExercises.length + 1,
        exercise: exercise
      };
      setCartExercises([...cartExercises, newItem]);
    }
  };

  // Eliminar ejercicio del carrito
  const removeFromCart = (exerciseId: string) => {
    const updatedCart = cartExercises.filter(item => item.exerciseId !== exerciseId);
    const reorderedCart = updatedCart.map((item, index) => ({
      ...item,
      order: index + 1
    }));
    setCartExercises(reorderedCart);
  };

  // Ajustar tiempo de un ejercicio
  const adjustTime = (exerciseId: string, adjustment: number) => {
    const updatedCart = cartExercises.map(item =>
      item.exerciseId === exerciseId
        ? { ...item, customTime: Math.max(1, (item.customTime || 0) + adjustment) }
        : item
    );
    setCartExercises(updatedCart);
  };

  // Mover ejercicio hacia arriba
  const moveExerciseUp = (index: number) => {
    if (index === 0) return;
    
    const newCart = [...cartExercises];
    [newCart[index - 1], newCart[index]] = [newCart[index], newCart[index - 1]];
    
    const reorderedCart = newCart.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));
    
    setCartExercises(reorderedCart);
  };

  // Mover ejercicio hacia abajo
  const moveExerciseDown = (index: number) => {
    if (index === cartExercises.length - 1) return;
    
    const newCart = [...cartExercises];
    [newCart[index], newCart[index + 1]] = [newCart[index + 1], newCart[index]];
    
    const reorderedCart = newCart.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));
    
    setCartExercises(reorderedCart);
  };

  // Drag and Drop functions
  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === targetIndex) return;
    const newCart = [...cartExercises];
    const [movedItem] = newCart.splice(draggedItem, 1);
    newCart.splice(targetIndex, 0, movedItem);
    const reorderedCart = newCart.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));
    setCartExercises(reorderedCart);
    setDraggedItem(null);
  };

  // Abrir formulario para editar entrenamiento
  const handleEdit = (training: Training) => {
    setEditingTraining(training);
    setFormData({
      name: training.name,
      categories: training.categories,
      observations: training.observations
    });
    setCartExercises(training.exercises);
    setTotalTime(training.totalTime);
    setShowForm(true);
  };

  // Resetear formulario
  const resetForm = () => {
    setEditingTraining(null);
    setFormData({ name: '', categories: [], observations: '' });
    setCartExercises([]);
    setTotalTime(0);
    setShowForm(false);
    setDraggedItem(null);
  };

  // Crear o actualizar entrenamiento
  const handleSaveTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cartExercises.length === 0) {
      alert('Agrega al menos un ejercicio al entrenamiento');
      return;
    }
    if (!formData.name.trim()) {
      alert('El nombre del entrenamiento es requerido');
      return;
    }

    try {
      const uniqueCategoryIds = Array.from(new Set(cartExercises.map(item =>
        item.exercise?.categoryId
      ).filter(Boolean))) as string[];

      const trainingData = {
        name: formData.name,
        categories: uniqueCategoryIds,
        exercises: cartExercises,
        totalTime: totalTime,
        observations: formData.observations
      };

      if (editingTraining) {
        const updatedTraining = await updateTraining(editingTraining.id, trainingData);
        const updatedTrainings = trainings.map(t =>
          t.id === editingTraining.id ? updatedTraining : t
        );
        setTrainings(updatedTrainings);
      } else {
        const newTraining = await createTraining(trainingData);
        setTrainings([...trainings, newTraining]);
      }
      
      resetForm();
      alert(editingTraining ? 'Entrenamiento actualizado correctamente' : 'Entrenamiento creado correctamente');
      
    } catch (error: any) {
      console.error('Error guardando entrenamiento:', error);
      alert(`Error al guardar el entrenamiento: ${error.message}. Por favor, intenta nuevamente.`);
    }
  };

  // Copiar enlace compartible
  const copyShareLink = (shareId: string) => {
    const shareUrl = `${window.location.origin}/training/${shareId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Enlace copiado al portapapeles!');
    }).catch(() => {
      prompt('Copia este enlace:', shareUrl);
    });
  };

  // Descargar PDF del entrenamiento
  const downloadPDF = async (training: Training) => {
    try {
      // Obtener usuario desde localStorage (sistema original)
const userData = localStorage.getItem('user');
const user = userData ? JSON.parse(userData) : {};
      
      const currentDate = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const categoryTimes: {[key: string]: {name: string, time: number, color: string}} = {};
      
      training.exercises.forEach((exerciseItem: TrainingExercise) => {
        const exercise = exerciseItem.exercise;
        if (exercise && exercise.category) {
          const categoryId = exercise.category.id;
          if (!categoryTimes[categoryId]) {
            categoryTimes[categoryId] = {
              name: exercise.category.name,
              time: 0,
              color: exercise.category.color
            };
          }
          categoryTimes[categoryId].time += exerciseItem.customTime || 0;
        }
      });

      const categoryArray = Object.values(categoryTimes);
      const totalTime = training.totalTime;
      
      const getCategoryColor = (tailwindClass: string) => {
        const baseColorClass = tailwindClass ? tailwindClass.split(' ')[0] : '';
     
        const colorMap: {[key: string]: {bg: string, text: string, border: string}} = {
          'bg-blue-100': { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
          'bg-red-100': { bg: '#fee2e2', text: '#dc2626', border: '#ef4444' },
          'bg-green-100': { bg: '#dcfce7', text: '#16a34a', border: '#22c55e' },
          'bg-yellow-100': { bg: '#fef9c3', text: '#ca8a04', border: '#eab308' },
          'bg-purple-100': { bg: '#f3e8ff', text: '#9333ea', border: '#a855f7' },
          'bg-orange-100': { bg: '#ffedd5', text: '#ea580c', border: '#f97316' },
          'bg-pink-100': { bg: '#fce7f3', text: '#db2777', border: '#ec4899' },
          'bg-indigo-100': { bg: '#e0e7ff', text: '#4338ca', border: '#6366f1' }
        };
     
        return colorMap[baseColorClass] || { bg: '#e5e7eb', text: '#374151', border: '#9ca3af' };
      };

      const pdfHTML = `
              
          
            
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; }
              .header { background: linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; margin-bottom: 20px; }
              .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
              .metric-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
              .exercise-card { border: 2px solid #e3f2fd; border-radius: 10px; padding: 15px; margin: 10px 0; background: white; }
              .distribution-bar { display: flex; height: 30px; border-radius: 8px; overflow: hidden; background: #e2e8f0; margin: 15px 0; }
              .footer { background: #1e293b; color: white; padding: 20px; text-align: center; margin-top: 30px; border-radius: 8px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0 0 10px 0;">SANSE COMPLUTENSE</h1>
              <p style="margin: 0 0 20px 0; opacity: 0.9;">Club de Hockey</p>
              <h2 style="margin: 0 0 15px 0;">${training.name}</h2>
              <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: left;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Preparador físico:</span>
                  <span style="font-weight: bold;">${user?.fullName || 'Usuario'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Fecha:</span>
                  <span style="font-weight: bold;">${currentDate}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Duración total:</span>
                  <span style="font-weight: bold;">${training.totalTime} minutos</span>
                </div>
              </div>
            </div>
            ${training.observations ? `
              <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #0ea5e9; margin-bottom: 20px;">
                <h3 style="color: #1565C0; margin: 0 0 10px 0;">📝 Observaciones</h3>
                <p style="margin: 0; line-height: 1.5;">${training.observations}</p>
              </div>
            ` : ''}
            <div class="metrics">
              <div class="metric-card">
                <div style="font-size: 32px; font-weight: bold;">${training.exercises.length}</div>
                <div>EJERCICIOS</div>
              </div>
              <div class="metric-card">
                <div style="font-size: 32px; font-weight: bold;">${training.totalTime}</div>
                <div>MINUTOS TOTALES</div>
              </div>
            </div>
            <h3 style="color: #1565C0; border-bottom: 2px solid #e3f2fd; padding-bottom: 10px;">💪 Ejercicios del Entrenamiento</h3>
            ${training.exercises.map((item: TrainingExercise, index: number) => {
              const exercise = item.exercise;
              const category = exercise?.category;
              const colors = category ? getCategoryColor(category.color) : { bg: '#e5e7eb', text: '#374151', border: '#9ca3af' };
             
              return `
                <div class="exercise-card">
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <div style="background: #1565C0; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                      ${index + 1}
                    </div>
                    <h4 style="margin: 0; color: #1565C0;">${exercise?.name || 'Ejercicio'}</h4>
                  </div>
                  <p style="margin: 0 0 10px 0; color: #6b7280; padding-left: 38px;">${exercise?.description || 'Sin descripción disponible'}</p>
                  <div style="display: flex; gap: 10px; padding-left: 38px;">
                    <span style="background: #fee2e2; color: #dc2626; padding: 4px 8px; border-radius: 15px; font-weight: bold;">
                      ⏱️ ${item.customTime} min
                    </span>
                    ${category ? `
                      <span style="background: ${colors.bg}; color: ${colors.text}; padding: 4px 8px; border-radius: 15px; font-weight: bold; border: 1px solid ${colors.border};">
                        ${category.name}
                      </span>
                    ` : `
                      <span style="background: #e5e7eb; color: #374151; padding: 4px 8px; border-radius: 15px; font-weight: bold; border: 1px solid #9ca3af;">
                        Sin categoría
                      </span>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 25px 0;">
              <h3 style="color: #1565C0; margin: 0 0 15px 0;">📊 Distribución de Tiempos por Categoría</h3>
              <div class="distribution-bar">
                ${categoryArray.map((category: any) => {
                  const percentage = (category.time / totalTime) * 100;
                  const colors = getCategoryColor(category.color);
                  return `<div style="width: ${percentage}%; background: ${colors.border};"></div>`;
                }).join('')}
                ${categoryArray.length === 0 ? `
                  <div style="width: 100%; background: #9ca3af; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                    Sin categorías
                  </div>
                ` : ''}
              </div>
              ${categoryArray.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: 15px;">
                  ${categoryArray.map((category: any) => {
                    const percentage = (category.time / totalTime) * 100;
                    const colors = getCategoryColor(category.color);
                    return `
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 12px; height: 12px; background: ${colors.border}; border-radius: 2px;"></div>
                        <span style="font-weight: bold;">${category.name}:</span>
                        <span>${category.time}min (${percentage.toFixed(1)}%)</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : `
            
            
            
              `}
        
          
        
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Por favor, intenta nuevamente.');
    }
  };

  // Eliminar entrenamiento
  const handleDeleteTraining = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el entrenamiento "${name}"?`)) {
      try {
        await deleteTraining(id);
        const updatedTrainings = trainings.filter(t => t.id !== id);
        setTrainings(updatedTrainings);
        alert('Entrenamiento eliminado correctamente');
      } catch (error: any) {
        console.error('Error eliminando entrenamiento:', error);
        alert(`Error al eliminar el entrenamiento: ${error.message}. Por favor, intenta nuevamente.`);
      }
    }
  };

  if (loading) return <div className="text-center p-8">Cargando entrenamientos...</div>;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-sanse-blue">Gestión de Entrenamientos</h1>
          <p className="text-gray-600">Crea y edita sesiones completas con el carrito de ejercicios</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-sanse-red text-white px-4 py-2 rounded-md hover:bg-red-700"
        >
          + Nuevo Entrenamiento
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-sanse-blue">{trainings.length}</div>
          <div className="text-sm text-gray-600">Total Entrenamientos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-green-600">
            {trainings.reduce((total: number, t: Training) => total + t.exercises.length, 0)}
          </div>
          <div className="text-sm text-gray-600">Ejercicios Totales</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-purple-600">
            {trainings.reduce((total: number, t: Training) => total + t.totalTime, 0)}
          </div>
          <div className="text-sm text-gray-600">Minutos Totales</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <div className="text-2xl font-bold text-orange-600">
            {trainings.length > 0 ? Math.round(trainings.reduce((total: number, t: Training) => total + t.totalTime, 0) / trainings.length) : 0}
          </div>
          <div className="text-sm text-gray-600">Promedio Minutos</div>
        </div>
      </div>

      {/* Modal de creación/edición de entrenamiento */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-sanse-blue">
                {editingTraining ? 'Editar Entrenamiento' : 'Crear Nuevo Entrenamiento'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Columna izquierda - Lista de ejercicios */}
              <div className="w-1/2 border-r p-6 overflow-y-auto">
                <h3 className="text-xl font-semibold mb-4">Ejercicios Disponibles</h3>
               
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Categorías disponibles:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category: Category) => (
                      <span
                        key={category.id}
                        className={`px-3 py-2 rounded-full text-sm font-medium ${category.color}`}
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Las categorías se asignarán automáticamente según los ejercicios seleccionados
                  </p>
                </div>
                <div className="space-y-3">
                  {exercises.map((exercise: Exercise) => (
                    <div key={exercise.id} className="bg-gray-50 p-4 rounded-lg border hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sanse-blue">{exercise.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{exercise.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-500">⏱️ {exercise.estimatedTime} min</span>
                            {exercise.category && (
                              <span className={`px-2 py-1 rounded-full text-xs ${exercise.category.color}`}>
                                {exercise.category.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => addToCart(exercise)}
                          className="ml-4 bg-sanse-blue text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm whitespace-nowrap"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  ))}
                 
                  {exercises.length === 0 && (
                    <div className="text-center p-8 text-gray-500">
                      No hay ejercicios disponibles
                    </div>
                  )}
                </div>
              </div>

              {/* Columna derecha - Carrito y formulario */}
              <div className="w-1/2 p-6 flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  {/* Formulario básico */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del entrenamiento *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                      placeholder="Ej: Entrenamiento Juveniles Semana 1"
                      required
                    />
                  </div>

                  {/* Carrito de ejercicios */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold">
                        Ejercicios seleccionados ({cartExercises.length})
                      </h3>
                      {cartExercises.length > 0 && (
                        <p className="text-sm text-gray-500">
                          Arrastra para reordenar o usa los botones ↑↓
                        </p>
                      )}
                    </div>
                   
                    {cartExercises.length === 0 ? (
                      <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">
                        <p>Agrega ejercicios desde la columna izquierda</p>
                        <p className="text-sm mt-2">Los ejercicios aparecerán aquí</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cartExercises.map((item: TrainingExercise, index: number) => (
                          <div
                            key={item.exerciseId}
                            className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-move ${
                              draggedItem === index ? 'opacity-50 border-sanse-blue' : ''
                            }`}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-gray-500 text-sm">#{index + 1}</span>
                                  <h4 className="font-medium text-sanse-blue">{item.exercise?.name}</h4>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => adjustTime(item.exerciseId, -5)}
                                      className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                                      disabled={(item.customTime || 0) <= 1}
                                    >
                                      -
                                    </button>
                                    <span className="font-semibold w-12 text-center">{item.customTime} min</span>
                                    <button
                                      onClick={() => adjustTime(item.exerciseId, 5)}
                                      className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                                    >
                                      +
                                    </button>
                                  </div>
                                  {item.exercise?.category && (
                                    <span className={`px-2 py-1 rounded-full text-xs ${item.exercise.category.color}`}>
                                      {item.exercise.category.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                             
                              <div className="flex flex-col gap-1 ml-2">
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => moveExerciseUp(index)}
                                    disabled={index === 0}
                                    className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Mover arriba"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => moveExerciseDown(index)}
                                    disabled={index === cartExercises.length - 1}
                                    className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Mover abajo"
                                  >
                                    ↓
                                  </button>
                                </div>
                               
                                <button
                                  onClick={() => removeFromCart(item.exerciseId)}
                                  className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                  title="Eliminar ejercicio"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Observaciones */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observaciones
                    </label>
                    <textarea
                      value={formData.observations}
                      onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sanse-blue"
                      rows={3}
                      placeholder="Notas adicionales para este entrenamiento..."
                    />
                  </div>
                </div>

                {/* Total y botones */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Tiempo total estimado:</span>
                    <span className="text-2xl font-bold text-sanse-blue">{totalTime} minutos</span>
                  </div>
                 
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTraining}
                      disabled={cartExercises.length === 0 || !formData.name.trim()}
                      className="flex-1 bg-sanse-blue text-white py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {editingTraining ? 'Actualizar Entrenamiento' : 'Crear Entrenamiento'}
                    </button>
                    <button
                      onClick={resetForm}
                      className="bg-gray-500 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de entrenamientos existentes */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-sanse-blue mb-6">Entrenamientos Existentes</h2>
       
        {trainings.length === 0 ? (
          <div className="text-center p-8 text-gray-500 bg-white rounded-lg shadow-md">
            No hay entrenamientos creados. ¡Crea el primero!
          </div>
        ) : (
          <div className="grid gap-6">
            {trainings.map((training: Training) => (
              <div key={training.id} className="bg-white p-6 rounded-lg shadow-md border hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-semibold text-sanse-blue">{training.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-500 ml-4">
                        <span>Editado: {new Date(training.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                   
                    {training.observations && (
                      <p className="text-gray-600 mb-3">{training.observations}</p>
                    )}
                   
                    <div className="flex items-center gap-6 text-sm mb-3">
                      <span className="flex items-center gap-1">
                        ⏱️ <strong>{training.totalTime} min</strong> total
                      </span>
                      <span className="flex items-center gap-1">
                        📊 <strong>{training.exercises.length}</strong> ejercicios
                      </span>
                      <span className="text-gray-500">
                        Creado: {new Date(training.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Categorías del entrenamiento */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {training.categories.map((catId: string) => {
                        const category = categories.find(c => c.id === catId);
                        return category ? (
                          <span key={catId} className={`px-2 py-1 rounded-full text-xs ${category.color}`}>
                            {category.name}
                          </span>
                        ) : null;
                      })}
                    </div>

                    {/* Ejercicios del entrenamiento */}
                    <div className="space-y-2">
                      {training.exercises.map((te: TrainingExercise, index: number) => (
                        <div key={index} className="flex items-center gap-3 text-sm bg-gray-50 p-2 rounded">
                          <span className="text-gray-500 w-6 text-center">{index + 1}.</span>
                          <span className="flex-1">{te.exercise?.name}</span>
                          <span className="text-gray-400">({te.customTime} min)</span>
                          {te.exercise?.category && (
                            <span className={`px-2 py-1 rounded-full text-xs ${te.exercise.category.color}`}>
                              {te.exercise.category.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-6 flex-col">
                    <button
                      onClick={() => handleEdit(training)}
                      className="bg-sanse-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm transition-colors"
                      title="Editar entrenamiento"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => copyShareLink(training.shareId)}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm transition-colors"
                      title="Copiar enlace para compartir"
                    >
                      📋 Compartir
                    </button>
                    <button
                      onClick={() => downloadPDF(training)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm transition-colors"
                      title="Descargar PDF"
                    >
                      📄 PDF
                    </button>
                    <button
                      onClick={() => handleDeleteTraining(training.id, training.name)}
                      className="bg-sanse-red text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm transition-colors"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Trainings;