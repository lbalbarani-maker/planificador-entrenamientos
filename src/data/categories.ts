export interface Category {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export const categories: Category[] = [
  {
    id: '1',
    name: 'Calentamiento',
    color: 'bg-blue-100 text-blue-800',
    createdBy: '2',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '2',
    name: 'Resistencia',
    color: 'bg-green-100 text-green-800',
    createdBy: '2',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '3',
    name: 'Fuerza',
    color: 'bg-red-100 text-red-800',
    createdBy: '2',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  }
];