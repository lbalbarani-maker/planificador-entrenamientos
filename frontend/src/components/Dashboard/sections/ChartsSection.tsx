import React from 'react';
import AttendanceTrendChart from '../charts/AttendanceTrendChart';
import EventsPieChart from '../charts/EventsPieChart';
import TeamPerformanceChart from '../charts/TeamPerformanceChart';

interface ChartsSectionProps {
  attendanceTrend: { date: string; rate: number; eventCount: number }[];
  eventsDistribution: { name: string; value: number; color: string }[];
  teamPerformance: { name: string; attendance: number; matches: number; wins: number }[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  attendanceTrend,
  eventsDistribution,
  teamPerformance,
}) => {
  const hasAnyChart = 
    (attendanceTrend && attendanceTrend.length > 0) ||
    (eventsDistribution && eventsDistribution.length > 0) ||
    (teamPerformance && teamPerformance.length > 0);

  if (!hasAnyChart) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AttendanceTrendChart data={attendanceTrend} />
      <EventsPieChart data={eventsDistribution} />
      <div className="lg:col-span-2">
        <TeamPerformanceChart data={teamPerformance} />
      </div>
    </div>
  );
};

export default ChartsSection;
