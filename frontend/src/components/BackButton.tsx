import React from 'react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to?: string;
  label?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ to = '/dashboard', label = 'Volver' }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-2 text-gray-600 hover:text-sanse-blue transition-colors mb-4"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="font-medium">{label}</span>
    </button>
  );
};

export default BackButton;
