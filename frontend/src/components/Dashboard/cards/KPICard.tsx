import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: string;
  trend?: { value: number; isPositive: boolean };
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = '#3b82f6',
  trend,
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-800 mb-1">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
};

export default KPICard;
