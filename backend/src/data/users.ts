export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'preparador';
  fullName: string;
  isActive: boolean;
}

// Contraseñas REALES hasheadas
export const users: User[] = [
  {
    id: '1',
    email: 'admin@sanse.com',
    passwordHash: '$2a$10$zQJ4XVccXa1AFd/.dnEgQuLHnh133CwhYuBQuZxgQHbYSjW82Enfu', // "admin123"
    role: 'admin',
    fullName: 'Administrador Principal',
    isActive: true
  },
  {
    id: '2', 
    email: 'hermana@sanse.com',
    passwordHash: '$2a$10$LMElU0yCrTmdZXpwmLcnweSsY0j.uRD/Du2zJoKgQkGesb/1ufBWG', // "hermana123"
    role: 'preparador',
    fullName: 'Preparadora Física',
    isActive: true
  }
];