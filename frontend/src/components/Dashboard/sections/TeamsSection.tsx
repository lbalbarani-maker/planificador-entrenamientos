import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRolePermissions } from '../../../hooks/useRolePermissions';
import { Team } from '../../../types/teams';

interface TeamsSectionProps {
  teams: Team[];
}

export const TeamsSection: React.FC<TeamsSectionProps> = ({ teams }) => {
  const { can } = useRolePermissions();
  const navigate = useNavigate();

  if (!can.view('sections.teams')) return null;
  if (!teams || teams.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">🏅 Equipos</h3>
        <button onClick={() => navigate('/teams')} className="text-sanse-blue text-sm font-medium">
          Ver todos →
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {teams.slice(0, 4).map((team) => (
          <button
            key={team.id}
            onClick={() => navigate(`/teams/${team.id}`)}
            className="p-3 bg-gray-50 rounded-xl text-left hover:bg-gray-100 transition-colors"
          >
            <p className="font-medium text-gray-800 truncate">{team.name}</p>
            <p className="text-xs text-gray-500">{team.category}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TeamsSection;
