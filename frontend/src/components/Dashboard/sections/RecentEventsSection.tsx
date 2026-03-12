import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRolePermissions } from '../../../hooks/useRolePermissions';
import { Event } from '../../../types/teams';

interface RecentEventsSectionProps {
  events: Event[];
}

export const RecentEventsSection: React.FC<RecentEventsSectionProps> = ({ events }) => {
  const { can } = useRolePermissions();
  const navigate = useNavigate();

  if (!can.view('sections.recentEvents')) return null;
  if (!events || events.length === 0) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
    
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'match': return '🏑';
      case 'training': return '🏋️';
      case 'meeting': return '📋';
      default: return '📅';
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'match': return 'Partido';
      case 'training': return 'Entreno';
      case 'meeting': return 'Reunión';
      default: return 'Evento';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">📅 Eventos Recientes</h3>
        <button onClick={() => navigate('/teams')} className="text-sanse-blue text-sm font-medium">
          Ver todos →
        </button>
      </div>
      <div className="space-y-2">
        {events.slice(0, 8).map((event) => (
          <div 
            key={event.id} 
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
            onClick={() => navigate(`/teams/${event.team_id}`)}
          >
            <div className="w-10 h-10 bg-sanse-blue/10 rounded-lg flex items-center justify-center text-xl">
              {getEventIcon(event.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">
                {getEventLabel(event.type)} {event.opponent && `vs ${event.opponent}`}
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(event.start_datetime)} • {formatTime(event.start_datetime)}
                {event.location && ` • ${event.location}`}
              </p>
            </div>
            {event.kit_color && (
              <div
                className="w-5 h-5 rounded-full border"
                style={{ backgroundColor: event.kit_color }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentEventsSection;
