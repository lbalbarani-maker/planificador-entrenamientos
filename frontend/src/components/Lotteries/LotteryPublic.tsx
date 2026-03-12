import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { lotteryApi } from '../../lib/supabaseLottery';
import { supabase } from '../../lib/supabase';
import { Lottery, TicketBlock, Ticket, Player, Sponsor } from '../../types/lottery';

const LotteryPublic: React.FC = () => {
  const { lotteryId, playerId, buyerId } = useParams<{ lotteryId: string; playerId?: string; buyerId?: string }>();
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerTickets, setBuyerTickets] = useState<Ticket[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuyerView, setIsBuyerView] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservedCount, setReservedCount] = useState(0);
  const [buyerData, setBuyerData] = useState({ name: '', phone: '', email: '' });
  const [showAgeModal, setShowAgeModal] = useState(false);

  const toggleTicket = (ticketId: string) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleBuySelected = () => {
    if (selectedTickets.length > 0) {
      setShowModal(true);
    }
  };

  useEffect(() => {
    if (buyerId) {
      loadBuyerData();
    } else if (lotteryId && playerId) {
      loadData();
    }
  }, [lotteryId, playerId, buyerId]);

  useEffect(() => {
    if (isBuyerView && buyerTickets.length > 0) {
      setShowAgeModal(true);
    }
  }, [isBuyerView, buyerTickets.length]);

  const loadBuyerData = async () => {
    setLoading(true);
    try {
      console.log('=== LOAD BUYER DATA ===');
      const urlParams = new URLSearchParams(window.location.search);
      const name = urlParams.get('name') || 'Comprador';
      console.log('Buyer name:', name);
      setBuyerName(decodeURIComponent(name));
      setIsBuyerView(true);

      const lotteryData = await lotteryApi.getLottery(lotteryId!);
      console.log('Lottery:', lotteryData);
      setLottery(lotteryData);

      const blocks = await lotteryApi.getTicketBlocks(lotteryId!);
      console.log('Blocks:', blocks.length);
      
      const allTickets: Ticket[] = [];
      for (const block of blocks) {
        let blockTickets = block.tickets || [];
        
        if (blockTickets.length === 0) {
          blockTickets = await lotteryApi.getTicketBlockTickets(block.id);
        }
        
        if (blockTickets.length === 0) {
          await lotteryApi.generateTicketsForBlock(block);
          blockTickets = await lotteryApi.getTicketBlockTickets(block.id);
        }
        
        console.log('Block tickets:', blockTickets.length, 'player:', block.player?.full_name);
        allTickets.push(...blockTickets);
      }

      console.log('Total tickets:', allTickets.length);
      const buyerTicketsList = allTickets.filter(t => 
        t.status === 'sold' && 
        t.buyer_name?.toLowerCase() === decodeURIComponent(name).toLowerCase()
      );
      
      console.log('Buyer tickets:', buyerTicketsList.length);
      setBuyerTickets(buyerTicketsList);

      if (lotteryData?.club_id) {
        const { data: sponsorsData } = await supabase
          .from('sponsors')
          .select('*')
          .eq('club_id', lotteryData.club_id)
          .order('created_at');
        if (sponsorsData) setSponsors(sponsorsData);
      }
    } catch (error) {
      console.error('Error loading buyer data:', error);
    } finally {
      setLoading(false);
      if (isBuyerView && buyerTickets.length > 0) {
        setShowAgeModal(true);
      }
    }
  };

  const loadData = async () => {
    try {
      console.log('=== LOTTERY PUBLIC DEBUG ===');
      console.log('lotteryId:', lotteryId);
      console.log('playerId:', playerId);
      
      const [lotteryData, playerData] = await Promise.all([
        lotteryApi.getLottery(lotteryId!),
        supabase.from('players').select('*').eq('id', playerId).single()
      ]);
      
      console.log('Lottery:', lotteryData);
      console.log('Player:', playerData.data);
      
      setLottery(lotteryData);
      setPlayer(playerData.data);

      if (lotteryData?.club_id) {
        const { data: sponsorsData } = await supabase
          .from('sponsors')
          .select('*')
          .eq('club_id', lotteryData.club_id)
          .order('created_at');
        if (sponsorsData) setSponsors(sponsorsData);
      }

      const blocks = await lotteryApi.getPlayerTicketBlocks(playerId!);
      console.log('Blocks for player:', blocks);
      console.log('Blocks count:', blocks.length);
      
      if (blocks.length > 0) {
        const allTickets: Ticket[] = [];
        const seenNumbers = new Set<number>();
        
        for (const block of blocks) {
          console.log('Block:', block);
          
          if (!block.tickets || block.tickets.length === 0) {
            console.log('Generating tickets for block...');
            await lotteryApi.generateTicketsForBlock(block);
          }
          
          const blockTickets = await lotteryApi.getTicketBlockTickets(block.id);
          console.log('Tickets for block:', blockTickets.length);
          
          for (const ticket of blockTickets) {
            if (!seenNumbers.has(ticket.number)) {
              seenNumbers.add(ticket.number);
              allTickets.push(ticket);
            }
          }
        }
        
        console.log('Total unique tickets:', allTickets.length);
        setTickets(allTickets);
      } else {
        console.log('No blocks found for this player');
        setTickets([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTickets.length === 0) return;

    try {
      for (const ticketId of selectedTickets) {
        await lotteryApi.updateTicketStatus(ticketId, 'sold', 'pending', buyerData);
      }
      await loadData();
      setReservedCount(selectedTickets.length);
      setShowModal(false);
      setShowSuccessModal(true);
      setSelectedTickets([]);
      setBuyerData({ name: '', phone: '', email: '' });
    } catch (error) {
      console.error('Error reserving tickets:', error);
      alert('Error al reservar las papeletas');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Lotería no encontrada</div>
      </div>
    );
  }

  if (isBuyerView && buyerTickets.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Comprador no encontrado</h2>
            <p className="text-gray-600">No se encontraron tickets asociados a este comprador.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isBuyerView && buyerTickets.length > 0) {
    const totalPaid = buyerTickets.length * lottery.ticket_price;
    const donationPerTicket = 1;
    const lotteryNumbers = lottery.lottery_number ? lottery.lottery_number.split('-').map(n => n.trim()).filter(n => n) : [];
    const lotteryAmountPerNumber = lotteryNumbers.length > 0 ? (lottery.ticket_price - donationPerTicket) / lotteryNumbers.length : lottery.ticket_price;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-sanse-blue to-blue-600 p-6 text-center">
              {lottery.club?.logo_url && (
                <img src={lottery.club.logo_url} alt="Club" className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white" />
              )}
              <h1 className="text-2xl font-bold text-white">{lottery.name}</h1>
              <p className="text-blue-200 text-sm">Confirmación de compra</p>
            </div>

            {/* Buyer Info */}
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl text-green-600">✓</span>
                </div>
                <h2 className="text-xl font-bold text-gray-800">¡Compra Confirmada!</h2>
                <p className="text-gray-600">Gracias por participar, {buyerName}!</p>
              </div>

              {/* Números de lotería */}
              {lotteryNumbers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">Mis Números</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {lotteryNumbers.map((num, idx) => (
                      <div key={idx} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center border-2 border-blue-300 flex items-center justify-center">
                        <span className="text-2xl font-bold text-blue-700">{num}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Cantidad de tacos:</span>
                  <span className="font-bold">{buyerTickets.length}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Precio por taco:</span>
                  <span className="font-bold">{lottery.ticket_price}€</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg font-bold text-sanse-blue">
                  <span>Total pagado:</span>
                  <span>{totalPaid}€</span>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <div className="flex justify-between text-gray-600">
                  <span>Lotería ({lotteryNumbers.length} números):</span>
                  <span className="font-bold">{lotteryNumbers.length * lotteryAmountPerNumber}€</span>
                </div>
                <div className="flex justify-between text-gray-600 mt-2">
                  <span>Donativo:</span>
                  <span className="font-bold">{donationPerTicket}€</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <p className="text-sm text-yellow-800 text-center">
                  El portador participa con {lotteryAmountPerNumber.toFixed(2)} EUROS en cada número arriba indicado para el sorteo de la Lotería Nacional que se celebró el {lottery.draw_date ? new Date(lottery.draw_date).toLocaleDateString('es-ES') : 'próximamente'}
                </p>
              </div>

              <div className="mt-4 p-4 bg-gray-100 rounded-xl">
                <p className="text-xs text-gray-600 text-center">
                  Los premios por décimo cuya cuantía sea superior a la que marque en cada momento la legislación vigente, tendrán la retención que dicha legislación disponga en la proporción correspondiente al valor nominal de estas participaciones.<br/><br/>
                  Toda papeleta rota, deteriorada, sin numerar o enmendada será nula.<br/>
                  Caduca a los 3 meses.
                </p>
              </div>

              {/* Mis Talones */}
              <div className="mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">Mis Talones</h3>
                <div className="grid grid-cols-5 gap-2 justify-items-center">
                  {buyerTickets.map(ticket => (
                    <div key={ticket.id} className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-2 flex items-center justify-center border-2 border-yellow-300 w-12">
                      <span className="text-xl font-bold text-yellow-700">
                        {ticket.number.toString().padStart(2, '0')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  {/* Modal +18 */}
  {showAgeModal && (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="text-6xl mb-4">🎰</div>
        <h2 className="text-3xl font-bold text-sanse-blue mb-4">+18</h2>
        <p className="text-gray-600 mb-6">Primera regla del juego:</p>
        <p className="text-xl font-bold text-gray-800 mb-6">¡Mucha suerte y que te toque!</p>
        <button
          onClick={() => setShowAgeModal(false)}
          className="bg-sanse-blue text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 w-full"
        >
          ¡Participar!
        </button>
      </div>
    </div>
  )}

  const availableTickets = tickets.filter(t => t.status === 'available');
  const soldTickets = tickets.filter(t => t.status === 'sold');
  const reservedTickets = tickets.filter(t => t.status === 'reserved');

  return (
    <div className="min-h-screen bg-gradient-to-br from-sanse-blue to-blue-700 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {lottery.club?.logo_url && (
            <img src={lottery.club.logo_url} alt="Club" className="w-20 h-20 rounded-full mx-auto mb-4 object-cover" />
          )}
          <h1 className="text-3xl font-bold text-white mb-2">{lottery.name}</h1>
          {player && <p className="text-blue-200">Ventas por: {player.full_name}</p>}
        </div>

        {/* Info */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-lg">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{availableTickets.length}</div>
              <div className="text-xs text-gray-500">Disponibles</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{soldTickets.length}</div>
              <div className="text-xs text-gray-500">Vendidas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{reservedTickets.length}</div>
              <div className="text-xs text-gray-500">Reservadas</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-center">
            <span className="text-3xl font-bold text-sanse-blue">{lottery.ticket_price}€</span>
            <p className="text-sm text-gray-500">por papeleta</p>
          </div>
        </div>

        {/* Sponsors */}
        {sponsors.length > 0 && (
          <div className="bg-white/10 rounded-xl p-4 mb-6">
            <p className="text-white text-center text-sm mb-3">Patrocinadores</p>
            <div className="flex flex-wrap justify-center gap-4">
              {sponsors.map(sponsor => (
                <div key={sponsor.id} className="bg-white rounded-lg p-2">
                  {sponsor.logo_url ? (
                    <img src={sponsor.logo_url} alt={sponsor.name} className="h-12 object-contain" />
                  ) : (
                    <span className="text-gray-800 font-bold">{sponsor.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tickets Grid - Butacas de cine */}
        <div className="bg-white rounded-xl p-4 shadow-lg mb-4">
          <h2 className="text-lg font-bold mb-4 text-center">Selecciona tus números</h2>
          
          <div className="grid grid-cols-5 gap-2">
            {tickets.map(ticket => {
              const isSelected = selectedTickets.includes(ticket.id);
              return (
                <button
                  key={ticket.id}
                  onClick={() => {
                    if (ticket.status === 'available') {
                      toggleTicket(ticket.id);
                    }
                  }}
                  disabled={ticket.status !== 'available'}
                  className={`py-3 px-1 rounded-lg text-sm font-bold transition-all transform hover:scale-105 ${
                    ticket.status === 'available'
                      ? isSelected
                        ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-300'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-200'
                      : ticket.status === 'reserved'
                      ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed opacity-70'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {ticket.number.toString().padStart(2, '0')}
                </button>
              );
            })}
          </div>
          
          {selectedTickets.length > 0 && (
            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-lg font-bold text-sanse-blue mb-2">
                {selectedTickets.length} papeletas seleccionadas
              </p>
              <button
                onClick={handleBuySelected}
                className="bg-sanse-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
              >
                Comprar {selectedTickets.length} papeletas ({selectedTickets.length * lottery.ticket_price}€)
              </button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center gap-4 text-white text-sm">
          <span className="flex items-center gap-1"><span className="w-4 h-4 bg-green-400 rounded"></span> Disponible</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 bg-yellow-400 rounded"></span> Reservada</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 bg-gray-400 rounded"></span> Vendida</span>
        </div>

        {/* Modal compra */}
        {showModal && selectedTickets.length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-xl font-bold mb-4 text-center">
                Comprar {selectedTickets.length} papeletas
              </h3>
              <p className="text-center text-gray-600 mb-4">
                Números: {selectedTickets.map(id => tickets.find(t => t.id === id)?.number).filter(n => n !== undefined).sort((a, b) => (a || 0) - (b || 0)).map(n => n?.toString().padStart(2, '0')).join(', ')}
              </p>
              <p className="text-center text-2xl font-bold text-sanse-blue mb-4">
                Total: {selectedTickets.length * lottery.ticket_price}€
              </p>
              
              <form onSubmit={handleReserve} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    value={buyerData.name}
                    onChange={(e) => setBuyerData({ ...buyerData, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={buyerData.phone}
                    onChange={(e) => setBuyerData({ ...buyerData, phone: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={buyerData.email}
                    onChange={(e) => setBuyerData({ ...buyerData, email: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                  >
                    Reservar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setSelectedTickets([]); }}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal confirmación éxito */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-xl font-bold mb-2">¡Reserva Confirmada!</h3>
              <p className="text-gray-600 mb-4">
                ¡{reservedCount} papeletas reservadas correctamente!
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Te contactaremos pronto para confirmar el pago.
              </p>
              <button
                onClick={() => { setShowSuccessModal(false); loadData(); }}
                className="bg-sanse-blue text-white py-2 px-6 rounded-lg hover:bg-blue-700 w-full"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LotteryPublic;
