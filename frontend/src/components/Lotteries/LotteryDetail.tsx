import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lotteryApi } from '../../lib/supabaseLottery';
import { supabase } from '../../lib/supabase';
import { Lottery, TicketBlock, Ticket, Player } from '../../types/lottery';
import BackButton from '../BackButton';

const CATEGORY_ORDER: Record<string, number> = {
  'infantil': 1,
  'cadete': 2,
  'juvenil': 3,
  'senior': 4,
  'absoluto': 5,
  'veterano': 6
};

const LotteryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [ticketBlocks, setTicketBlocks] = useState<TicketBlock[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerCategories, setPlayerCategories] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({ total: 0, sold: 0, available: 0, reserved: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<{ assigned: number; pending: number } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(10);
  
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'pending'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchPlayer, setSearchPlayer] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [lotteryData, blocksData, playersData, statsData, playerTeamsData] = await Promise.all([
        lotteryApi.getLottery(id!),
        lotteryApi.getTicketBlocks(id!),
        supabase.from('players').select('*').eq('is_active', true).order('full_name'),
        lotteryApi.getLotteryStats(id!),
        supabase.from('team_players').select('player_id, team:teams(id, category)')
      ]);
      
      const categoryMap: Record<string, string> = {};
      playerTeamsData.data?.forEach((pt: any) => {
        if (pt.team?.category) {
          categoryMap[pt.player_id] = pt.team.category.toLowerCase();
        }
      });
      
      setLottery(lotteryData);
      setTicketBlocks(blocksData);
      setPlayers(playersData.data || []);
      setPlayerCategories(categoryMap);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBlockStats = (block: TicketBlock) => {
    const tickets = block.tickets || [];
    const calculatedTotal = (block.end_number || 0) - (block.start_number || 0) + 1;
    
    const uniqueNumbers = new Set(tickets.map((t: any) => t.number));
    const uniqueArray = Array.from(uniqueNumbers);
    const sold = uniqueArray.filter(n => tickets.find((t: any) => t.number === n)?.status === 'sold').length;
    const pending = uniqueArray.filter(n => tickets.find((t: any) => t.number === n)?.payment_status === 'pending').length;
    const paid = uniqueArray.filter(n => tickets.find((t: any) => t.number === n)?.payment_status === 'paid').length;
    
    return { sold, pending, paid, total: calculatedTotal };
  };

  const filteredBlocks = useMemo(() => {
    let result = [...ticketBlocks];
    
    if (searchPlayer) {
      const search = searchPlayer.toLowerCase();
      result = result.filter(b => b.player?.full_name?.toLowerCase().includes(search));
    }
    
    if (filterStatus === 'assigned') {
      result = result.filter(b => b.player_id);
    } else if (filterStatus === 'unassigned') {
      result = result.filter(b => !b.player_id);
    }
    
    if (filterCategory !== 'all') {
      result = result.filter(b => {
        const cat = playerCategories[b.player_id || ''] || 'absoluto';
        return cat === filterCategory;
      });
    }
    
    if (filterPayment !== 'all') {
      result = result.filter(b => {
        const stats = getBlockStats(b);
        if (filterPayment === 'paid') return stats.paid > 0;
        if (filterPayment === 'pending') return stats.pending > 0 || stats.sold === 0;
        return true;
      });
    }
    
    return result.sort((a, b) => {
      const catA = CATEGORY_ORDER[playerCategories[a.player_id || ''] || 'absoluto'] || 99;
      const catB = CATEGORY_ORDER[playerCategories[b.player_id || ''] || 'absoluto'] || 99;
      if (catA !== catB) return catA - catB;
      return (a.player?.full_name || '').localeCompare(b.player?.full_name || '');
    });
  }, [ticketBlocks, searchPlayer, filterStatus, filterCategory, filterPayment, playerCategories]);

  const paginatedBlocks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBlocks.slice(start, start + pageSize);
  }, [filteredBlocks, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredBlocks.length / pageSize);

  const availablePlayers = useMemo(() => {
    const assignedPlayerIds = new Set(ticketBlocks.filter(b => b.player_id).map(b => b.player_id));
    return players.filter(p => !assignedPlayerIds.has(p.id));
  }, [players, ticketBlocks]);

  const ticketsPerTaco = useMemo(() => {
    if (ticketBlocks.length > 0) {
      const firstBlock = ticketBlocks[0];
      return (firstBlock.end_number || 0) - (firstBlock.start_number || 0) + 1;
    }
    return 25;
  }, [ticketBlocks]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchPlayer, filterStatus, filterCategory, filterPayment]);

  const getPlayersWithCategory = async (): Promise<Player[]> => {
    const { data: playerTeams } = await supabase
      .from('team_players')
      .select('player_id, team:teams(category)')
      .in('player_id', players.map(p => p.id));

    const categoryMap: Record<string, string> = {};
    playerTeams?.forEach((pt: any) => {
      if (pt.team?.category) {
        categoryMap[pt.player_id] = pt.team.category.toLowerCase();
      }
    });

    return players.map(p => ({
      ...p,
      category: categoryMap[p.id] || 'absoluto'
    })).sort((a, b) => {
      const catA = CATEGORY_ORDER[a.category || 'absoluto'] || 99;
      const catB = CATEGORY_ORDER[b.category || 'absoluto'] || 99;
      if (catA !== catB) return catA - catB;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  };

  const handleAutoAssign = async () => {
    setAssigning(true);
    try {
      console.log('=== DEBUG AUTO ASSIGN ===');
      
      const { data: allPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      console.log('Total players activos:', allPlayers?.length || 0);

      if (!allPlayers || allPlayers.length === 0) {
        alert('No hay jugadores activos');
        setAssigning(false);
        return;
      }

      const playerIds = allPlayers.map(p => p.id);
      
      const { data: playerTeams } = await supabase
        .from('team_players')
        .select('player_id, team:teams(category)')
        .in('player_id', playerIds);

      const categoryMap: Record<string, string> = {};
      playerTeams?.forEach((pt: any) => {
        if (pt.team?.category) {
          categoryMap[pt.player_id] = pt.team.category.toLowerCase();
        }
      });

      const playersWithCategory = allPlayers.map(p => ({
        ...p,
        category: categoryMap[p.id] || 'absoluto'
      })).sort((a, b) => {
        const catA = CATEGORY_ORDER[a.category || 'absoluto'] || 99;
        const catB = CATEGORY_ORDER[b.category || 'absoluto'] || 99;
        if (catA !== catB) return catA - catB;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });

      console.log('Current ticketBlocks:', ticketBlocks.length);
      
      const assignedPlayerIds = new Set(ticketBlocks.filter(b => b.player_id).map(b => b.player_id));
      const blocksWithPlayer = ticketBlocks.filter(b => b.player_id).length;
      const blocksWithoutPlayer = ticketBlocks.filter(b => !b.player_id).length;
      
      let calculatedTicketsPerTaco = 25;
      if (ticketBlocks.length > 0) {
        const firstBlock = ticketBlocks[0];
        calculatedTicketsPerTaco = (firstBlock.end_number || 0) - (firstBlock.start_number || 0) + 1;
      }
      
      console.log('Blocks with player:', blocksWithPlayer);
      console.log('Blocks without player:', blocksWithoutPlayer);
      
      const playersNeedingBlocks = playersWithCategory.filter(p => !assignedPlayerIds.has(p.id));
      console.log('Players needing blocks:', playersNeedingBlocks.length);
      
      if (playersNeedingBlocks.length === 0) {
        alert('Todos los jugadores ya tienen un taco asignado');
        setAssigning(false);
        return;
      }
      
      const ticketsPerTaco = calculatedTicketsPerTaco;
      
      const unassignedBlocks = ticketBlocks.filter(b => !b.player_id);
      console.log('Unassigned blocks available:', unassignedBlocks.length);
      
      if (unassignedBlocks.length > 0) {
        console.log('Assigning existing blocks to players...');
        for (let i = 0; i < Math.min(playersNeedingBlocks.length, unassignedBlocks.length); i++) {
          const player = playersNeedingBlocks[i];
          const block = unassignedBlocks[i];
          
          console.log(`Assigning block ${block.id} to ${player.full_name}`);
          
          await lotteryApi.updateTicketBlock(block.id, { player_id: player.id });
        }
        
        setAssignResult({
          assigned: Math.min(playersNeedingBlocks.length, unassignedBlocks.length),
          pending: Math.max(0, playersNeedingBlocks.length - unassignedBlocks.length)
        });
      } else {
        console.log('Creating new blocks...');
        let currentNumber = 1;
        if (ticketBlocks.length > 0) {
          const maxEndNumber = Math.max(...ticketBlocks.map(b => b.end_number || 0));
          currentNumber = maxEndNumber + 1;
        }

        for (let i = 0; i < playersNeedingBlocks.length; i++) {
          const player = playersNeedingBlocks[i];
          if (currentNumber > lottery!.total_tickets) break;
          
          const blockEnd = Math.min(currentNumber + ticketsPerTaco - 1, lottery!.total_tickets);
          
          console.log(`Creating block for ${player.full_name}: ${currentNumber} - ${blockEnd}`);
          
          await lotteryApi.createTicketBlock({
            lottery_id: id!,
            player_id: player.id,
            start_number: currentNumber,
            end_number: blockEnd
          });
          
          currentNumber = blockEnd + 1;
        }
        
        setAssignResult({
          assigned: playersNeedingBlocks.length,
          pending: 0
        });
      }
      
      await loadData();
      console.log('Data reloaded');
    } catch (error) {
      console.error('Error auto-assigning:', error);
      alert('Error al asignar los tacos');
    } finally {
      setAssigning(false);
      console.log('=== END DEBUG ===');
    }
  };

  const handleAssignBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const calculatedEndNumber = startNumber + ticketsPerTaco - 1;
      
      if (!lottery) {
        alert('Error: No se encontró la lotería');
        return;
      }
      
      if (startNumber < 1 || calculatedEndNumber > lottery.total_tickets) {
        alert(`Los números deben estar entre 1 y ${lottery.total_tickets}`);
        return;
      }
      
      const overlappingBlocks = ticketBlocks.filter(block => {
        if (!block.player_id) return false;
        const blockStart = block.start_number || 0;
        const blockEnd = block.end_number || 0;
        return (startNumber >= blockStart && startNumber <= blockEnd) ||
               (calculatedEndNumber >= blockStart && calculatedEndNumber <= blockEnd) ||
               (startNumber <= blockStart && calculatedEndNumber >= blockEnd);
      });

      if (overlappingBlocks.length > 0) {
        const conflictingPlayers = overlappingBlocks.map(b => b.player?.full_name).join(', ');
        alert(`Los números del ${startNumber.toString().padStart(4, '0')} al ${calculatedEndNumber.toString().padStart(4, '0')} ya están asignados a: ${conflictingPlayers}`);
        return;
      }
      
      await lotteryApi.createTicketBlock({
        lottery_id: id!,
        player_id: selectedPlayer,
        start_number: startNumber,
        end_number: calculatedEndNumber
      });
      
      await loadData();
      setShowAssignModal(false);
      setSelectedPlayer('');
      setStartNumber(1);
      alert('Taco asignado correctamente');
    } catch (error) {
      console.error('Error assigning block:', error);
      alert('Error al asignar el taco');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <BackButton to="/lotteries" />
          <div className="text-center py-8">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <BackButton to="/lotteries" />
          <div className="text-center py-8">Lotería no encontrada</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <BackButton to="/lotteries" />
        
        <div className="mb-6 mt-4">
          <h1 className="text-3xl font-bold text-sanse-blue">🎰 {lottery.name}</h1>
          {lottery.description && <p className="text-gray-600">{lottery.description}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-sanse-blue">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.sold}</div>
            <div className="text-sm text-gray-600">Vendidas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.available}</div>
            <div className="text-sm text-gray-600">Disponibles</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.reserved}</div>
            <div className="text-sm text-gray-600">Reservadas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.revenue}€</div>
            <div className="text-sm text-gray-600">Recaudado</div>
          </div>
        </div>

        {/* Distribución de tacos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Distribución de Tacos</h2>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/lotteries/${id}/sales`)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
              >
                📊 Ver Ventas
              </button>
              <button
                onClick={() => setShowAutoAssignModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                + Asignar Automático
              </button>
              <button
                onClick={() => setShowAssignModal(true)}
                className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Asignar Manual
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Buscar jugador</label>
                <input
                  type="text"
                  value={searchPlayer}
                  onChange={(e) => setSearchPlayer(e.target.value)}
                  placeholder="Nombre..."
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="all">Todos</option>
                  <option value="assigned">Asignado</option>
                  <option value="unassigned">Sin asignar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cobro</label>
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value as any)}
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="all">Todos</option>
                  <option value="paid">Cobrados</option>
                  <option value="pending">Pendientes</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="all">Todas</option>
                  <option value="infantil">Infantil</option>
                  <option value="cadete">Cadete</option>
                  <option value="juvenil">Juvenil</option>
                  <option value="senior">Senior</option>
                  <option value="absoluto">Absoluto</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mostrar</label>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="20">20 por página</option>
                  <option value="50">50 por página</option>
                  <option value="100">100 por página</option>
                </select>
              </div>
            </div>
          </div>

          {filteredBlocks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay tacos que mostrar</p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedBlocks.map(block => {
                  const blockStats = getBlockStats(block);
                  const category = playerCategories[block.player_id || ''] || 'Sin categoría';
                  const publicUrl = block.player_id ? `${window.location.origin}/lottery/${id}/player/${block.player_id}` : null;
                  
                  const handleCopyLink = () => {
                    if (publicUrl) {
                      navigator.clipboard.writeText(publicUrl);
                      alert('Enlace copiado al portapapeles');
                    }
                  };
                  
                  const handleOpenLink = () => {
                    if (publicUrl) {
                      window.open(publicUrl, '_blank');
                    }
                  };
                  
                  return (
                    <div key={block.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold">{block.player?.full_name || 'Sin asignar'}</p>
                          <p className="text-sm text-gray-500">
                            {block.start_number.toString().padStart(4, '0')} - {block.end_number.toString().padStart(4, '0')} ({blockStats.total} papeletas)
                          </p>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600 capitalize">{category}</span>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-sm flex gap-3">
                            <span className="text-green-600" title="Vendidas">✅ {blockStats.sold}</span>
                            <span className="text-blue-600" title="Disponibles">🔵 {blockStats.total - blockStats.sold}</span>
                            <span className={blockStats.paid > 0 ? 'text-green-600' : 'text-yellow-600'} title={blockStats.paid > 0 ? 'Cobrado' : 'Pendiente'}>
                              {blockStats.paid > 0 ? '💰 Cobrado' : '⏳ Pendiente'}
                            </span>
                          </div>
                          {block.player_id && (
                            <div className="flex gap-2">
                              <button
                                onClick={handleOpenLink}
                                className="px-3 py-1 text-xs bg-sanse-blue text-white rounded hover:bg-blue-700"
                              >
                                👁️ Ver
                              </button>
                              <button
                                onClick={handleCopyLink}
                                className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                📋 Copiar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginación */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredBlocks.length)} de {filteredBlocks.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <span className="px-3 py-1 text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    »»
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal asignar taco */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Asignar Taco a Jugador</h3>
              
              {/* Mostrar bloques ocupados */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                <p className="font-medium text-gray-700 mb-2">Bloques ya asignados:</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {ticketBlocks.filter(b => b.player_id).map(block => (
                    <div key={block.id} className="flex justify-between text-gray-600">
                      <span>{block.player?.full_name}</span>
                      <span className="font-mono">{block.start_number?.toString().padStart(4, '0')} - {block.end_number?.toString().padStart(4, '0')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAssignBlock} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jugador (disponible)</label>
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleccionar jugador...</option>
                    {availablePlayers.map(player => (
                      <option key={player.id} value={player.id}>{player.full_name}</option>
                    ))}
                  </select>
                  {availablePlayers.length === 0 && (
                    <p className="text-sm text-red-500 mt-1">No hay jugadores disponibles</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número inicial</label>
                    <input
                      type="number"
                      min="1"
                      max={lottery.total_tickets}
                      value={startNumber}
                      onChange={(e) => setStartNumber(parseInt(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número final</label>
                    <input
                      type="number"
                      value={startNumber + ticketsPerTaco - 1}
                      className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100"
                      disabled
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Este taco tendrá {ticketsPerTaco} papeletas (del {startNumber} al {startNumber + ticketsPerTaco - 1})
                </p>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                    disabled={availablePlayers.length === 0}
                  >
                    Asignar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAssignModal(false); setSelectedPlayer(''); setStartNumber(1); }}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Asignar Automático */}
        {showAutoAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Asignar Tacos Automáticamente</h3>
              
              {!assignResult ? (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-yellow-800">
                      Se asignará <strong>1 taco por cada jugador activo</strong> de forma automática.
                    </p>
                    <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                      <li>Orden: Primero por categoría (Infantil → Cadete → Juvenil → Senior)</li>
                      <li>Dentro de cada categoría: Orden alfabético</li>
                      <li>Cada taco tendrá las papeletas disponibles</li>
                    </ul>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-gray-600">
                      Jugadores activos sin taco asignado: <strong>{availablePlayers.length}</strong>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      (Los jugadores que ya tienen un taco no se modificarán)
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAutoAssign}
                      disabled={assigning || availablePlayers.length === 0}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {assigning ? 'Asignando...' : 'Asignar Automáticamente'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAutoAssignModal(false); setAssignResult(null); }}
                      className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-green-800 font-bold">
                      ✅ Se asignaron {assignResult.assigned} tacos automáticamente
                    </p>
                    {assignResult.pending > 0 && (
                      <p className="text-yellow-700 mt-2">
                        Quedan {assignResult.pending} tacos pendientes de asignar
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowAutoAssignModal(false); setAssignResult(null); }}
                    className="w-full bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LotteryDetail;
