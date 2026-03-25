import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useRolePermissions } from '../../../hooks/useRolePermissions';

interface TopPlayerSeller {
  playerId: string;
  playerName: string;
  ticketsSold: number;
  revenue: number;
}

interface TopTeamSeller {
  teamId: string;
  teamName: string;
  ticketsSold: number;
  revenue: number;
}

interface LotterySellersSectionProps {
  topPlayerSellers: TopPlayerSeller[];
  topTeamSellers: TopTeamSeller[];
}

export const LotterySellersSection: React.FC<LotterySellersSectionProps> = ({
  topPlayerSellers,
  topTeamSellers,
}) => {
  const { can } = useRolePermissions();

  if (!can.view('sections.lotterySellers')) return null;
  if (topPlayerSellers.length === 0 && topTeamSellers.length === 0) return null;

  const medals = ['🥇', '🥈', '🥉'];
  const teamColors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899'];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="font-bold text-gray-800">🎫 Ranking Vendedores</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Equipos - Gráfico de barras vertical */}
        {topTeamSellers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">🏅 Top Equipos</h4>
            <div className="h-36">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart 
                  data={topTeamSellers.slice(0, 5)} 
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <XAxis 
                    dataKey="teamName" 
                    tick={{ fontSize: 9, fill: '#374151' }}
                    tickFormatter={(value) => value.length > 10 ? value.substring(0, 10) + '..' : value}
                    interval={0}
                    height={20}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#374151' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value, name, props) => [
                      `${value} tickets (€${props.payload.revenue})`,
                      'Ventas'
                    ]}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Bar 
                    dataKey="ticketsSold" 
                    radius={[4, 4, 0, 0]}
                    animationDuration={800}
                  >
                    {topTeamSellers.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={teamColors[index % teamColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Jugadores - Podio con 3 primeros */}
        {topPlayerSellers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">👤 Top 3 Jugadores</h4>
            <div className="flex justify-center items-end gap-2 h-36 pt-6">
              {topPlayerSellers.slice(0, 3).map((player, index) => (
                <div 
                  key={player.playerId} 
                  className="flex flex-col items-center"
                  title={`${player.ticketsSold} tickets - €${player.revenue}`}
                >
                  {/* Medalla */}
                  <div className="text-2xl mb-0.5">{medals[index]}</div>
                  
                  {/* Barra visual */}
                  <div 
                    className="w-14 sm:w-16 rounded-t-lg flex items-end justify-center pb-1"
                    style={{ 
                      height: `${40 + (player.ticketsSold / Math.max(...topPlayerSellers.slice(0, 3).map(p => p.ticketsSold))) * 50}px`,
                      backgroundColor: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : '#d97706'
                    }}
                  >
                    <span className="text-white font-bold text-[10px] text-center px-1 truncate max-w-full">
                      {player.playerName.split(' ')[0]}
                    </span>
                  </div>
                  
                  {/* Números */}
                  <div className="text-center mt-1">
                    <p className="font-bold text-sanse-blue text-xs">{player.ticketsSold}</p>
                    <p className="text-[8px] text-gray-500">tickets</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LotterySellersSection;
