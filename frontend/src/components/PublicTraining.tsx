import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

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
  category?: Category;
}

interface TrainingExercise {
  exerciseId: string;
  customTime: number;
  order: number;
  exercise?: Exercise;
}

interface Training {
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

const PublicTraining: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estados del cronómetro
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
 

  // Datos de ejemplo (en producción vendrían de una API)
  useEffect(() => {
    const mockTraining: Training = {
      id: '1',
      name: 'Entrenamiento Juveniles Semana 1',
      categories: ['1', '2'],
      exercises: [
        {
          exerciseId: '1',
          customTime: 10, // 10 minutos
          order: 1,
          exercise: {
            id: '1',
            name: 'Calentamiento articular',
            description: 'Rotaciones de tobillos, rodillas, caderas, hombros y cuello',
            estimatedTime: 10,
            categoryId: '1',
            category: { id: '1', name: 'Calentamiento', color: 'bg-blue-100 text-blue-800' }
          }
        },
        {
          exerciseId: '2',
          customTime: 15, // 15 minutos
          order: 2,
          exercise: {
            id: '2',
            name: 'Carrera continua',
            description: 'Trote suave alrededor del campo durante 15 minutos',
            estimatedTime: 15,
            categoryId: '2',
            category: { id: '2', name: 'Resistencia', color: 'bg-green-100 text-green-800' }
          }
        },
        {
          exerciseId: '3',
          customTime: 20, // 20 minutos
          order: 3,
          exercise: {
            id: '3',
            name: 'Estaciones de fuerza',
            description: 'Circuito con pesas, sentadillas, flexiones y abdominales',
            estimatedTime: 25,
            categoryId: '3',
            category: { id: '3', name: 'Fuerza', color: 'bg-red-100 text-red-800' }
          }
        }
      ],
      totalTime: 45,
      observations: 'Enfocado en resistencia aeróbica y técnica básica. Realizar cada ejercicio con cuidado y mantener una hidratación adecuada.',
      createdBy: '1',
      createdAt: '2024-01-20',
      updatedAt: '2024-01-20',
      shareId: 'abc123'
    };

    // Simular carga de API
    setTimeout(() => {
      if (shareId === 'abc123') {
        setTraining(mockTraining);
        // Convertir minutos a segundos para el cronómetro
        setTimeLeft((mockTraining.exercises[0]?.customTime || 0) * 60);
      } else {
        setError('Entrenamiento no encontrado');
      }
      setLoading(false);
    }, 1000);
  }, [shareId]);

  // Efecto para el cronómetro
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Ejercicio completado
            clearInterval(timerRef.current!);
            playCompletionSound();
            setShowAlert(true);
            setIsRunning(false);
            
            // Ocultar alerta después de 5 segundos
            setTimeout(() => setShowAlert(false), 5000);
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, timeLeft]);

  // Sonido de completado
  const playCompletionSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);
    } catch (error) {
      console.log('Audio no disponible');
    }
  };

  const startTimer = () => {
    setIsRunning(true);
    setShowAlert(false);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft((training?.exercises[currentExerciseIndex]?.customTime || 0) * 60);
    setShowAlert(false);
  };

  const nextExercise = () => {
    if (training && currentExerciseIndex < training.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setTimeLeft(training.exercises[currentExerciseIndex + 1].customTime * 60);
      setIsRunning(false);
      setShowAlert(false);
    } else {
      // Entrenamiento completado
      setIsCompleted(true);
      setIsRunning(false);
    }
  };

  const previousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(prev => prev - 1);
      setTimeLeft((training?.exercises[currentExerciseIndex - 1]?.customTime || 0) * 60);
      setIsRunning(false);
      setShowAlert(false);
      setIsCompleted(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!training) return 0;
    const totalExercises = training.exercises.length;
    return ((currentExerciseIndex + (timeLeft === 0 ? 1 : 0)) / totalExercises) * 100;
  };

  const getCurrentExercise = () => {
    return training?.exercises[currentExerciseIndex];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sanse-blue flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Cargando entrenamiento...</p>
        </div>
      </div>
    );
  }

  if (error || !training) {
    return (
      <div className="min-h-screen bg-sanse-blue flex items-center justify-center">
        <div className="bg-white bg-opacity-10 p-8 rounded-lg shadow-md text-center max-w-md text-white">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-2">Entrenamiento no encontrado</h1>
          <p className="mb-4 opacity-90">
            {error || 'El enlace que seguiste puede haber expirado o no existe.'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-white text-sanse-blue px-6 py-2 rounded-md hover:bg-gray-100 font-semibold"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  const currentExercise = getCurrentExercise();

  return (
    <div className="min-h-screen bg-sanse-dark-blue text-white">
      {/* Header minimalista */}
      <header className="bg-sanse-red shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <img 
              src="/images/logosanse.png" 
              alt="Sanse Complutense" 
              className="h-10 w-10 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold">Sanse Complutense</h1>
              <p className="text-sm opacity-80">Modo Entrenamiento</p>
            </div>
          </div>
        </div>
      </header>

      {/* Alerta de ejercicio completado */}
      {showAlert && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-green-500 text-white px-8 py-4 rounded-lg shadow-lg text-center">
            <div className="text-2xl mb-2">🎉</div>
            <div className="font-bold text-lg">¡Ejercicio Completado!</div>
            <div className="text-sm">Procede al siguiente ejercicio</div>
          </div>
        </div>
      )}

      {/* Entrenamiento completado */}
      {isCompleted && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-gray-800 rounded-lg shadow-xl p-8 max-w-md text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl font-bold text-sanse-blue mb-4">¡Entrenamiento Completado!</h2>
            <p className="text-gray-600 mb-6">
              Has completado todos los ejercicios. ¡Excelente trabajo!
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded">
                <div className="font-bold text-sanse-blue">{training.exercises.length}</div>
                <div>Ejercicios</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="font-bold text-green-600">{training.totalTime}</div>
                <div>Minutos totales</div>
              </div>
            </div>
            <button
              onClick={() => {
                setCurrentExerciseIndex(0);
                setTimeLeft(training.exercises[0].customTime * 60);
                setIsCompleted(false);
                setIsRunning(false);
              }}
              className="w-full bg-sanse-blue text-white py-3 rounded-md hover:bg-blue-700 mt-6 font-semibold"
            >
              Reiniciar Entrenamiento
            </button>
          </div>
        </div>
      )}

      <main className="container mx-auto py-6 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Panel del cronómetro - OCUPA ANCHO COMPLETO */}
          <div className="bg-white bg-opacity-10 rounded-lg shadow-md p-6 backdrop-blur-sm">
            {/* Barra de progreso del entrenamiento */}
            <div className="mb-6">
              <div className="flex justify-between text-sm opacity-80 mb-2">
                <span>Progreso del entrenamiento</span>
                <span>{Math.round(getProgressPercentage())}%</span>
              </div>
              <div className="w-full bg-white bg-opacity-20 rounded-full h-3">
                <div 
                  className="bg-white h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
            </div>

            {/* Ejercicio actual */}
            {currentExercise && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  {currentExercise.exercise?.category && (
                    <span className="px-3 py-1 rounded-full text-sm bg-white bg-opacity-20">
                      {currentExercise.exercise.category.name}
                    </span>
                  )}
                  <span className="opacity-80">
                    Ejercicio {currentExerciseIndex + 1} de {training.exercises.length}
                  </span>
                </div>
                
                <h2 className="text-3xl font-bold mb-3">
                  {currentExercise.exercise?.name}
                </h2>
                
                <p className="text-lg opacity-90 mb-8">
                  {currentExercise.exercise?.description}
                </p>

                {/* Cronómetro GRANDE y prominente */}
                <div className="bg-white bg-opacity-10 rounded-2xl p-8 mb-8 border border-white border-opacity-20">
                  <div className="text-8xl font-mono font-bold mb-8 text-white">
                    {formatTime(timeLeft)}
                  </div>
                  
                  <div className="flex justify-center gap-4 mb-6">
                    {!isRunning ? (
                      <button
                        onClick={startTimer}
                        className="bg-green-500 text-white px-12 py-4 rounded-xl hover:bg-green-600 font-bold text-xl shadow-lg transition-all"
                      >
                        ▶️ INICIAR
                      </button>
                    ) : (
                      <button
                        onClick={pauseTimer}
                        className="bg-yellow-500 text-white px-12 py-4 rounded-xl hover:bg-yellow-600 font-bold text-xl shadow-lg transition-all"
                      >
                        ⏸️ PAUSAR
                      </button>
                    )}
                    <button
                      onClick={resetTimer}
                      className="bg-gray-500 text-white px-8 py-4 rounded-xl hover:bg-gray-600 font-bold text-xl shadow-lg transition-all"
                    >
                      🔄 REINICIAR
                    </button>
                  </div>

                  {/* Barra de progreso del ejercicio */}
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-4">
                    <div 
                      className="bg-green-400 h-4 rounded-full transition-all duration-1000 ease-linear"
                      style={{ 
                        width: `${((currentExercise.customTime * 60 - timeLeft) / (currentExercise.customTime * 60)) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Navegación entre ejercicios */}
                <div className="flex justify-between max-w-md mx-auto">
                  <button
                    onClick={previousExercise}
                    disabled={currentExerciseIndex === 0}
                    className="bg-white bg-opacity-20 text-white px-8 py-3 rounded-xl hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
                  >
                    ← Anterior
                  </button>
                  
                  <button
                    onClick={nextExercise}
                    className="bg-white bg-opacity-20 text-white px-8 py-3 rounded-xl hover:bg-opacity-30 font-semibold transition-all"
                  >
                    {currentExerciseIndex === training.exercises.length - 1 ? 'Finalizar' : 'Siguiente →'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de ejercicios - OCUPA ANCHO COMPLETO */}
          <div className="bg-white bg-opacity-10 rounded-lg shadow-md p-6 backdrop-blur-sm">
            <h3 className="text-2xl font-semibold mb-6 text-center">
              Lista de Ejercicios
            </h3>
            
            <div className="space-y-4">
              {training.exercises.map((exercise, index) => (
                <div
                  key={exercise.exerciseId}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    index === currentExerciseIndex
                      ? 'border-white bg-white bg-opacity-20 shadow-lg'
                      : index < currentExerciseIndex
                      ? 'border-green-400 bg-green-400 bg-opacity-20'
                      : 'border-white border-opacity-30 hover:border-opacity-50'
                  }`}
                  onClick={() => {
                    if (!isRunning) {
                      setCurrentExerciseIndex(index);
                      setTimeLeft(exercise.customTime * 60);
                      setIsCompleted(false);
                      setShowAlert(false);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                        index === currentExerciseIndex
                          ? 'bg-white text-sanse-blue'
                          : index < currentExerciseIndex
                          ? 'bg-green-400 text-white'
                          : 'bg-white bg-opacity-30 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-lg">
                          {exercise.exercise?.name}
                        </div>
                        <div className="opacity-80">
                          {exercise.customTime} min
                        </div>
                      </div>
                    </div>
                    
                    {index < currentExerciseIndex && (
                      <div className="text-green-400 text-2xl">✅</div>
                    )}
                    {index === currentExerciseIndex && isRunning && (
                      <div className="animate-pulse text-white text-2xl">▶️</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen minimalista */}
            <div className="mt-8 pt-6 border-t border-white border-opacity-20">
              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold">{training.exercises.length}</div>
                  <div className="opacity-80">Total Ejercicios</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-400">{currentExerciseIndex}</div>
                  <div className="opacity-80">Completados</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicTraining;