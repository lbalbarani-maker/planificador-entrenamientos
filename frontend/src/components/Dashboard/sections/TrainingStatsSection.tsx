import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRolePermissions } from '../../../hooks/useRolePermissions';

interface TrainingStat {
  eventId: string;
  total: number;
  confirmed: number;
  declined: number;
  pending: number;
  teamName: string;
  eventDate: string;
}

interface TrainingStatsSectionProps {
  stats: TrainingStat[];
}

export const TrainingStatsSection: React.FC<TrainingStatsSectionProps> = ({ stats }) => {
  const { can } = useRolePermissions();
  const navigate = useNavigate();

  if (!can.view('sections.trainingStats')) return null;
  if (!stats || stats.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">🏋️ Asistencia a Entrenamientos</h3>
      </div>
      <div className="space-y-3">
        {stats.map((stat) => {
          const attendanceRate = stat.total > 0 ? Math.round((stat.confirmed / stat.total) * 100) : 0;
          const colorClass = attendanceRate >= 70 ? 'bg-green-500' : attendanceRate >= 40 ? 'bg-yellow-500' : 'bg-red-500';
          
          return (
            <div 
              key={stat.eventId}
              className="p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{stat.teamName}</p>
                  <p className="text-xs text-gray-500">{stat.eventDate}</p>
                </div>
                <span className={`text-xs font-bold ${
                  attendanceRate >= 70 ? 'text-green-600' : attendanceRate >= 40 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {attendanceRate}% asistencia
                </span>
              </div>
              <div className="flex gap-3 text-xs mb-2">
                <span className="flex items-center gap-1 text-green-600">
                  ✅ {stat.confirmed}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  ❌ {stat.declined}
                </span>
                <span className="flex items-center gap-1 text-gray-500">
                  ⏳ {stat.pending}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${colorClass} transition-all duration-500`}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrainingStatsSection;
