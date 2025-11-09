export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  estimatedTime: number;
  categoryId: string;
  createdBy?: string;
  createdAt?: string;
  category?: Category;
}

export interface TrainingExercise {
  exerciseId: string;
  customTime: number;
  order: number;
  exercise?: Exercise;
}

export interface Training {
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