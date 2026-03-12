import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useRolePermissions } from '../../../hooks/useRolePermissions';

interface TeamPerformanceChartProps {
  data: { name: string; attendance: number; matches: number; wins: number }[];
}

export const TeamPerformanceChart: React.FC<TeamPerformanceChartProps> = ({ data }) => {
  const { can } = useRolePermissions();

  if (!can.view('charts.teamPerformance')) return null;
  if (!data || data.length === 0) return null;

  const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899'];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="font-bold text-gray-800 mb-4">📊 Rendimiento por Equipo</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              angle={-15}
              textAnchor="end"
              height={50}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              formatter={(value, name) => [
                name === 'attendance' ? `${value}%` : value,
                name === 'attendance' ? 'Asistencia' : name === 'matches' ? 'Partidos' : 'Victorias'
              ]}
            />
            <Bar yAxisId="left" dataKey="attendance" radius={[4, 4, 0, 0]} animationDuration={1000}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.attendance >= 70 ? '#22c55e' : entry.attendance >= 50 ? '#eab308' : '#ef4444'} />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="matches" fill="#3b82f6" radius={[4, 4, 0, 0]} animationDuration={1000} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500"></span>
          Alta (&gt;70%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-500"></span>
          Media (50-70%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500"></span>
          Baja (&lt;50%)
        </span>
      </div>
    </div>
  );
};

export default TeamPerformanceChart;
