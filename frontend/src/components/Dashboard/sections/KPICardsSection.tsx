import React from 'react';
import KPICard from '../cards/KPICard';
import { useRolePermissions } from '../../../hooks/useRolePermissions';
import { DashboardData } from '../../../hooks/useDashboardData';

interface KPICardsSectionProps {
  data: DashboardData['kpi'];
}

export const KPICardsSection: React.FC<KPICardsSectionProps> = ({ data }) => {
  const { can } = useRolePermissions();

  const metrics = [
    {
      permission: 'metrics.players' as const,
      title: 'Jugadores',
      value: data.totalPlayers,
      icon: '👥',
      color: '#3b82f6',
      subtitle: 'Activos',
    },
    {
      permission: 'metrics.teams' as const,
      title: 'Equipos',
      value: data.totalTeams,
      icon: '🏅',
      color: '#8b5cf6',
      subtitle: 'Registrados',
    },
    {
      permission: 'metrics.attendance' as const,
      title: 'Asistencia',
      value: `${data.avgAttendance}%`,
      icon: '✅',
      color: '#22c55e',
      subtitle: 'Promedio',
      trend: { value: 5, isPositive: true } as const,
    },
    {
      permission: 'metrics.matches' as const,
      title: 'Partidos',
      value: data.matchesPlayed,
      icon: '🏑',
      color: '#f97316',
      subtitle: 'Jugados',
    },
    {
      permission: 'metrics.lottery' as const,
      title: 'Tickets Vendidos',
      value: data.lotteryTicketsSold,
      icon: '🎫',
      color: '#ec4899',
      subtitle: 'Lotería',
    },
    {
      permission: 'metrics.lottery' as const,
      title: 'Ingresos Lotería',
      value: `€${data.lotteryRevenue}`,
      icon: '💰',
      color: '#eab308',
      subtitle: 'Total vendido',
    },
  ];

  const visibleMetrics = can.getFilteredSections(metrics);

  if (visibleMetrics.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {visibleMetrics.map((metric, index) => (
        <KPICard
          key={index}
          title={metric.title}
          value={metric.value}
          subtitle={metric.subtitle}
          icon={metric.icon}
          color={metric.color}
          trend={metric.trend}
        />
      ))}
    </div>
  );
};

export default KPICardsSection;
