export interface TrainingExercise {
  exerciseId: string;
  customTime: number; // Tiempo ajustado para este entrenamiento
  order: number; // Orden en el entrenamiento
}

export interface Training {
  id: string;
  name: string;
  categories: string[]; // IDs de categorías
  exercises: TrainingExercise[];
  totalTime: number;
  observations: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  shareId: string; // ID único para compartir
}

export const trainings: Training[] = [
  {
    id: '1',
    name: 'Entrenamiento Juveniles Semana 1',
    categories: ['1', '2'], // Calentamiento + Resistencia
    exercises: [
      { exerciseId: '1', customTime: 10, order: 1 },
      { exerciseId: '2', customTime: 15, order: 2 }
    ],
    totalTime: 25,
    observations: 'Enfocado en resistencia aeróbica',
    createdBy: '2',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
    shareId: 'abc123'
  }
];