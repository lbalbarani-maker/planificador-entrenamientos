import express from 'express';
import bcrypt from 'bcryptjs';
import { users, User } from '../data/users';

const router = express.Router();

// Middleware para verificar admin (básico por ahora)
const requireAdmin = (req: any, res: any, next: any) => {
  // En una app real, verificarías el token JWT
  next();
};

// Obtener todos los usuarios (solo admin)
router.get('/', requireAdmin, (req, res) => {
  try {
    // Excluir passwords por seguridad
    const usersWithoutPasswords = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      isActive: user.isActive
    }));
    
    res.json({
      success: true,
      data: usersWithoutPasswords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
});

// Crear nuevo usuario (preparador)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Validaciones
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, contraseña y nombre son requeridos'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya existe'
      });
    }

    // Hash de la contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Crear nuevo usuario
    const newUser: User = {
      id: (users.length + 1).toString(),
      email,
      passwordHash,
      role: 'preparador',
      fullName,
      isActive: true
    };

    users.push(newUser);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        fullName: newUser.fullName,
        isActive: newUser.isActive
      }
    });

  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar usuario
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, fullName, isActive, password } = req.body;

    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Actualizar campos
    if (email) users[userIndex].email = email;
    if (fullName) users[userIndex].fullName = fullName;
    if (isActive !== undefined) users[userIndex].isActive = isActive;

    // Si se proporciona nueva contraseña
    if (password) {
      const saltRounds = 10;
      users[userIndex].passwordHash = await bcrypt.hash(password, saltRounds);
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: {
        id: users[userIndex].id,
        email: users[userIndex].email,
        role: users[userIndex].role,
        fullName: users[userIndex].fullName,
        isActive: users[userIndex].isActive
      }
    });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;