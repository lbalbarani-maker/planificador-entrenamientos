import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lotteryApi } from '../../lib/supabaseLottery';
import { supabase } from '../../lib/supabase';
import { Lottery } from '../../types/lottery';
import { Club } from '../../types/teams';
import BackButton from '../BackButton';

const LotteriesList: React.FC = () => {
  const navigate = useNavigate();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLottery, setEditingLottery] = useState<Lottery | null>(null);
  const [formData, setFormData] = useState({
    club_id: '',
    name: '',
    description: '',
    draw_date: '',
    ticket_price: 5,
    donation_per_ticket: 1,
    start_number: 1,
    num_tacos: 10,
    tickets_per_taco: 25,
    lottery_numbers: ['', '']
  });

  const totalTickets = formData.num_tacos * formData.tickets_per_taco;
  const endNumber = formData.start_number + totalTickets - 1;
  const totalLottery = (formData.ticket_price - formData.donation_per_ticket) * totalTickets;
  const totalDonation = formData.donation_per_ticket * totalTickets;
  const lotteryNumberString = formData.lottery_numbers.filter(n => n).join('-');

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadLotteries();
    loadClubs();
  }, []);

  const loadClubs = async () => {
    const { data } = await supabase.from('clubs').select('*').order('name');
    if (data) setClubs(data);
  };

  const loadLotteries = async () => {
    try {
      const data = await lotteryApi.getLotteries();
      setLotteries(data);
    } catch (error) {
      console.error('Error loading lotteries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLottery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lottery = await lotteryApi.createLottery({
        club_id: formData.club_id,
        name: formData.name,
        description: formData.description,
        draw_date: formData.draw_date || undefined,
        ticket_price: formData.ticket_price,
        total_tickets: totalTickets,
        lottery_number: lotteryNumberString || undefined
      });
      
      await lotteryApi.generateTickets(lottery.id, formData.start_number, totalTickets);
      
      const tacoList = [];
      let currentNum = formData.start_number;
      for (let i = 0; i < formData.num_tacos; i++) {
        const tacoEnd = currentNum + formData.tickets_per_taco - 1;
        tacoList.push({
          lottery_id: lottery.id,
          player_id: null,
          start_number: currentNum,
          end_number: tacoEnd
        });
        currentNum = tacoEnd + 1;
      }
      
      await lotteryApi.createTicketBlocks(tacoList);
      
      await loadLotteries();
      setShowForm(false);
      setFormData({ club_id: '', name: '', description: '', draw_date: '', ticket_price: 5, donation_per_ticket: 1, start_number: 1, num_tacos: 10, tickets_per_taco: 25, lottery_numbers: ['', ''] });
      alert('Lotería creada correctamente');
    } catch (error: any) {
      console.error('Error creating lottery:', error);
      alert(error.message || 'Error al crear la lotería');
    }
  };

  const handleDeleteLottery = async (id: string, name: string) => {
    if (window.confirm(`¿Eliminar la lotería "${name}"?`)) {
      try {
        await lotteryApi.deleteLottery(id);
        await loadLotteries();
      } catch (error) {
        console.error('Error deleting lottery:', error);
        alert('Error al eliminar la lotería');
      }
    }
  };

  const handleEditLottery = (lottery: Lottery) => {
    const numbers = lottery.lottery_number ? lottery.lottery_number.split('-') : ['', ''];
    setEditingLottery(lottery);
    setFormData({
      club_id: lottery.club_id,
      name: lottery.name,
      description: lottery.description || '',
      draw_date: lottery.draw_date ? lottery.draw_date.split('T')[0] : '',
      ticket_price: lottery.ticket_price,
      donation_per_ticket: 1,
      start_number: 1,
      num_tacos: Math.ceil(lottery.total_tickets / 25),
      tickets_per_taco: 25,
      lottery_numbers: [numbers[0] || '', numbers[1] || '']
    });
    setShowForm(true);
  };

  const handleUpdateLottery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLottery) return;
    
    try {
      await lotteryApi.updateLottery(editingLottery.id, {
        club_id: formData.club_id,
        name: formData.name,
        description: formData.description || undefined,
        draw_date: formData.draw_date || undefined,
        ticket_price: formData.ticket_price,
        lottery_number: lotteryNumberString || undefined
      });
      
      await loadLotteries();
      setShowForm(false);
      setEditingLottery(null);
      setFormData({ club_id: '', name: '', description: '', draw_date: '', ticket_price: 5, donation_per_ticket: 1, start_number: 1, num_tacos: 10, tickets_per_taco: 25, lottery_numbers: ['', ''] });
      alert('Lotería actualizada correctamente');
    } catch (error: any) {
      console.error('Error updating lottery:', error);
      alert(error.message || 'Error al actualizar la lotería');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLottery(null);
    setFormData({ club_id: '', name: '', description: '', draw_date: '', ticket_price: 5, donation_per_ticket: 1, start_number: 1, num_tacos: 10, tickets_per_taco: 25, lottery_numbers: ['', ''] });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <BackButton to="/dashboard" />
          <div className="text-center py-8">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <BackButton to="/dashboard" />
        
        <div className="flex justify-between items-center mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold text-sanse-blue">🎰 Loterías</h1>
            <p className="text-gray-600">Gestión de loterías del club</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + Nueva Lotería
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">{editingLottery ? 'Editar Lotería' : 'Nueva Lotería'}</h2>
            <form onSubmit={editingLottery ? handleUpdateLottery : handleCreateLottery} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Club *</label>
                <select
                  value={formData.club_id}
                  onChange={(e) => setFormData({ ...formData, club_id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seleccionar club...</option>
                  {clubs.map(club => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de sorteo 1</label>
                    <input
                      type="text"
                      value={formData.lottery_numbers[0]}
                      onChange={(e) => setFormData({ ...formData, lottery_numbers: [e.target.value, formData.lottery_numbers[1]] })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      placeholder="ej: 91693"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de sorteo 2</label>
                    <input
                      type="text"
                      value={formData.lottery_numbers[1]}
                      onChange={(e) => setFormData({ ...formData, lottery_numbers: [formData.lottery_numbers[0], e.target.value] })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      placeholder="ej: 82812"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de sorteo</label>
                  <input
                    type="date"
                    value={formData.draw_date}
                    onChange={(e) => setFormData({ ...formData, draw_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número inicial papeleta</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.start_number}
                    onChange={(e) => setFormData({ ...formData, start_number: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº de tacos *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.num_tacos}
                    onChange={(e) => setFormData({ ...formData, num_tacos: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Papeletas por taco *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.tickets_per_taco}
                    onChange={(e) => setFormData({ ...formData, tickets_per_taco: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio papeleta (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.ticket_price}
                    onChange={(e) => setFormData({ ...formData, ticket_price: parseFloat(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Donativo por papeleta (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.donation_per_ticket}
                    onChange={(e) => setFormData({ ...formData, donation_per_ticket: parseFloat(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-800 mb-2">Resumen</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total papeletas:</span>
                    <div className="font-bold text-lg text-sanse-blue">{totalTickets}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Números:</span>
                    <div className="font-bold text-lg">{formData.start_number} - {endNumber}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Precio/papeleta:</span>
                    <div className="font-bold text-lg">{formData.ticket_price.toFixed(2)}€</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Para la lotería:</span>
                    <div className="font-bold text-lg text-green-600">{totalLottery.toFixed(2)}€</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Donativo club:</span>
                    <div className="font-bold text-lg text-purple-600">{totalDonation.toFixed(2)}€</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold text-gray-700 mb-2">Vista previa de tacos</h3>
                <div className="text-sm text-gray-600 max-h-32 overflow-y-auto">
                  {Array.from({ length: Math.min(formData.num_tacos, 20) }, (_, i) => {
                    const tacoStart = formData.start_number + (i * formData.tickets_per_taco);
                    const tacoEnd = tacoStart + formData.tickets_per_taco - 1;
                    return (
                      <div key={i} className="flex justify-between py-1 border-b border-gray-200">
                        <span>Taco {i + 1}</span>
                        <span className="font-mono">{tacoStart.toString().padStart(4, '0')} - {tacoEnd.toString().padStart(4, '0')}</span>
                      </div>
                    );
                  })}
                  {formData.num_tacos > 20 && (
                    <div className="text-center py-2 text-gray-500">... y {formData.num_tacos - 20} tacos más</div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  {editingLottery ? 'Guardar Cambios' : 'Crear Lotería'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          {lotteries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay loterías creadas</p>
          ) : (
            <div className="space-y-4">
              {lotteries.map(lottery => (
                <div key={lottery.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800">{lottery.name}</h3>
                      {lottery.description && <p className="text-gray-600 text-sm">{lottery.description}</p>}
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>💰 {lottery.ticket_price}€</span>
                        <span>🎫 {lottery.total_tickets} papeletas</span>
                        {lottery.draw_date && <span>📅 {new Date(lottery.draw_date).toLocaleDateString('es-ES')}</span>}
                        {lottery.lottery_number && <span>🔢 #{lottery.lottery_number}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/lotteries/${lottery.id}`)}
                        className="bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 text-sm"
                        title="Ver detalles"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleEditLottery(lottery)}
                        className="bg-sanse-blue text-white px-2 py-1 rounded hover:bg-blue-700 text-sm"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteLottery(lottery.id, lottery.name)}
                        className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 text-sm"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LotteriesList;
