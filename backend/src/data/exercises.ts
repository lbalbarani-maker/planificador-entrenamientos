export interface Exercise {
  id: string;
  name: string;
  description: string;
  estimatedTime: number; // en minutos
  categoryId: string;
  createdBy: string; // ID del usuario que lo creó
  createdAt: Date;
  updatedAt: Date;
  }

// Datos de ejemplo para empezar
export const exercises: Exercise[] = [
  {
    id: '1',
    name: 'Calentamiento articular',
    description: 'Rotaciones de tobillos, rodillas, caderas, hombros y cuello',
    estimatedTime: 10,
    categoryId: 'calentamiento',
    createdBy: '2', // ID de tu hermana
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '2',
    name: 'Carrera continua',
    description: 'Trote suave alrededor del campo durante 15 minutos',
    estimatedTime: 15,
    categoryId: 'resistencia',
    createdBy: '2',
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16')
  },
  {
    id: '3',
    name: 'Estaciones de fuerza',
    description: 'Circuito con pesas, sentadillas, flexiones y abdominales',
    estimatedTime: 25,
    categoryId: 'fuerza',
    createdBy: '2',
    createdAt: new Date('2024-01-17'),
    updatedAt: new Date('2024-01-17')
  }
];