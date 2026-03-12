import React from 'react';
import { useNavigate } from 'react-router-dom';

export const QuickActionsSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => navigate('/match')}
        className="bg-orange-500 text-white p-4 rounded-2xl flex items-center gap-3 hover:bg-orange-600 transition-colors"
      >
        <span className="text-2xl">🏑</span>
        <div>
          <p className="font-bold">Partidos</p>
          <p className="text-xs opacity-80">Marcador en vivo</p>
        </div>
      </button>
      <button
        onClick={() => navigate('/trainings')}
        className="bg-green-500 text-white p-4 rounded-2xl flex items-center gap-3 hover:bg-green-600 transition-colors"
      >
        <span className="text-2xl">🏋️</span>
        <div>
          <p className="font-bold">Entrenos</p>
          <p className="text-xs opacity-80">Crear sesiones</p>
        </div>
      </button>
    </div>
  );
};

export default QuickActionsSection;
