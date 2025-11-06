import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import exerciseRoutes from './routes/exercises';
import categoryRoutes from './routes/categories';
import trainingRoutes from './routes/trainings';
import userRoutes from './routes/users';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares - IMPORTANTE: cors() debe ir primero
app.use(cors({
  origin: 'http://localhost:3000', // URL del frontend
  credentials: true
}));
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/exercises', exerciseRoutes); 
app.use('/api/categories', categoryRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/users', userRoutes); 

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend del Planificador Sanse funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});