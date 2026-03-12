import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useRolePermissions } from '../../../hooks/useRolePermissions';

interface AttendanceTrendChartProps {
  data: { date: string; rate: number; eventCount: number }[];
}

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({ data }) => {
  const { can } = useRolePermissions();

  if (!can.view('charts.attendanceTrend')) return null;
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="font-bold text-gray-800 mb-4">📈 Tendencia de Asistencia</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              formatter={(value) => [`${value}%`, 'Asistencia']}
            />
            <Line 
              type="monotone" 
              dataKey="rate" 
              stroke="#22c55e" 
              strokeWidth={3}
              dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#16a34a' }}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AttendanceTrendChart;
