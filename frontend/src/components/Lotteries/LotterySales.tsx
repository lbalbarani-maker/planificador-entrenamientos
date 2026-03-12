import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lotteryApi } from '../../lib/supabaseLottery';
import { supabase } from '../../lib/supabase';
import { Lottery, Ticket } from '../../types/lottery';
import BackButton from '../BackButton';

interface BuyerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  playerId: string;
  playerName: string;
  tickets: Ticket[];
  totalPaid: number;
}

const LotterySales: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [buyers, setBuyers] = useState<BuyerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlayer, setFilterPlayer] = useState('all');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      console.log('Loading sales data for lottery:', id);
      const lotteryData = await lotteryApi.getLottery(id!);
      console.log('Lottery:', lotteryData);
      setLottery(lotteryData);

      const blocks = await lotteryApi.getTicketBlocks(id!);
      console.log('Blocks:', blocks.length);
      
      const buyerMap = new Map<string, BuyerInfo>();
      
      for (const block of blocks) {
        let tickets = block.tickets || [];
        
        if (tickets.length === 0) {
          tickets = await lotteryApi.getTicketBlockTickets(block.id);
        }
        
        console.log('Tickets for block:', tickets.length, 'player:', block.player?.full_name);
        
        for (const ticket of tickets) {
          if (ticket.status === 'sold' && ticket.buyer_name) {
            const buyerKey = ticket.buyer_name.toLowerCase();
            
            if (!buyerMap.has(buyerKey)) {
              buyerMap.set(buyerKey, {
                id: ticket.id,
                name: ticket.buyer_name || '',
                email: ticket.buyer_email || '',
                phone: ticket.buyer_phone || '',
                playerId: block.player_id || '',
                playerName: block.player?.full_name || 'Sin asignar',
                tickets: [],
                totalPaid: 0
              });
            }
            
            const buyer = buyerMap.get(buyerKey)!;
            buyer.tickets.push(ticket);
            buyer.totalPaid += lotteryData?.ticket_price || 0;
          }
        }
      }

      console.log('Buyers:', Array.from(buyerMap.values()));
      setBuyers(Array.from(buyerMap.values()));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const uniquePlayers = useMemo(() => {
    const players = new Map<string, string>();
    buyers.forEach(b => {
      if (b.playerId) players.set(b.playerId, b.playerName);
    });
    return Array.from(players.entries()).map(([id, name]) => ({ id, name }));
  }, [buyers]);

  const filteredBuyers = useMemo(() => {
    let result = [...buyers];
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(b => 
        b.name.toLowerCase().includes(search) ||
        b.email.toLowerCase().includes(search) ||
        b.phone.includes(search)
      );
    }
    
    if (filterPlayer !== 'all') {
      result = result.filter(b => b.playerId === filterPlayer);
    }
    
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [buyers, searchTerm, filterPlayer]);

  const stats = useMemo(() => {
    const totalSold = buyers.reduce((sum, b) => sum + b.tickets.length, 0);
    const totalRevenue = buyers.reduce((sum, b) => sum + b.totalPaid, 0);
    return { totalSold, totalRevenue };
  }, [buyers]);

  const handleGeneratePDF = (buyer: BuyerInfo) => {
    const url = `${window.location.origin}/lottery/${id}/buyer/${buyer.id}?name=${encodeURIComponent(buyer.name)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton to={`/lotteries/${id}`} />
          <div className="text-center py-8">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <BackButton to={`/lotteries/${id}`} />
        
        <div className="mb-6 mt-4">
          <h1 className="text-3xl font-bold text-sanse-blue">📊 Ventas - {lottery?.name}</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-sanse-blue">{stats.totalSold}</div>
            <div className="text-sm text-gray-600">Papeletas Vendidas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.totalRevenue}€</div>
            <div className="text-sm text-gray-600">Total Recaudado</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{buyers.length}</div>
            <div className="text-sm text-gray-600">Compradores</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, email o teléfono..."
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="w-full md:w-64">
              <select
                value={filterPlayer}
                onChange={(e) => setFilterPlayer(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Todos los vendedores</option>
                {uniquePlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de compradores */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Comprador</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Vendido por</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Teléfono</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Números</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Importe</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuyers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No hay compradores registrados
                  </td>
                </tr>
              ) : (
                filteredBuyers.map(buyer => (
                  <tr key={buyer.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{buyer.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                        {buyer.playerName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{buyer.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{buyer.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {buyer.tickets.slice(0, 5).map(t => (
                          <span key={t.id} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {t.number.toString().padStart(2, '0')}
                          </span>
                        ))}
                        {buyer.tickets.length > 5 && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            +{buyer.tickets.length - 5}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-green-600">{buyer.totalPaid}€</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleGeneratePDF(buyer)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        🔗 Link
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LotterySales;
