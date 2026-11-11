import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lotteryAdminApi, getLotteryAdminSession } from '../../lib/lotteryAdmin';
import { supabase } from '../../lib/supabase';
import { Lottery } from '../../types/lottery';
import { Club, Team } from '../../types/teams';
import BackButton from '../BackButton';
import { useAppDialog } from '../AppDialog';

interface LotteryFormData {
  club_id: string;
  name: string;
  description: string;
  draw_date: string;
  ticket_price: number;
  donation_per_ticket: number;
  start_number: number;
  num_tacos: number;
  tickets_per_taco: number;
  lottery_numbers: [string, string];
  auto_assign: boolean;
  team_id: string;
}

const emptyForm: LotteryFormData = {
  club_id: '',
  name: '',
  description: '',
  draw_date: '',
  ticket_price: 5,
  donation_per_ticket: 1,
  start_number: 1,
  num_tacos: 10,
  tickets_per_taco: 25,
  lottery_numbers: ['', ''],
  auto_assign: true,
  team_id: '',
};

const LotteriesList: React.FC = () => {
  const navigate = useNavigate();
  const dialog = useAppDialog();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLottery, setEditingLottery] = useState<Lottery | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<LotteryFormData>(emptyForm);

  const totalTickets = formData.num_tacos * formData.tickets_per_taco;
  const endNumber = formData.start_number + totalTickets - 1;
  const totalLottery = (formData.ticket_price - formData.donation_per_ticket) * totalTickets;
  const totalDonation = formData.donation_per_ticket * totalTickets;

  useEffect(() => {
    loadLotteries();
    loadClubs();
  }, []);

  useEffect(() => {
    if (!formData.club_id) {
      setTeams([]);
      return;
    }
    supabase
      .from('teams')
      .select('*')
      .eq('club_id', formData.club_id)
      .order('name')
      .then(({ data }) => setTeams(data || []));
  }, [formData.club_id]);

  const loadClubs = async () => {
    const { data } = await supabase.from('clubs').select('*').order('name');
    if (data) setClubs(data);
  };

  const loadLotteries = async () => {
    try {
      if (!getLotteryAdminSession()) {
        throw new Error('Sesión de administración caducada. Vuelve a iniciar sesión.');
      }
      const data = await lotteryAdminApi.list();
      setLotteries(data);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las loterías');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLottery = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await lotteryAdminApi.create({
        clubId: formData.club_id,
        name: formData.name,
        description: formData.description,
        drawDate: formData.draw_date || undefined,
        ticketPrice: formData.ticket_price,
        donationPerTicket: formData.donation_per_ticket,
        numTacos: formData.num_tacos,
        ticketsPerTaco: formData.tickets_per_taco,
        startNumber: formData.start_number,
        lotteryNumber1: formData.lottery_numbers[0],
        lotteryNumber2: formData.lottery_numbers[1],
        autoAssign: formData.auto_assign,
        teamId: formData.team_id || undefined,
      });
      await loadLotteries();
      setShowForm(false);
      setFormData(emptyForm);
      await dialog.alert({
        title: 'Lotería creada',
        message: 'Lotería creada correctamente.',
        variant: 'success',
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Error al crear la lotería');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLottery = async (lottery: Lottery) => {
    const confirmed = await dialog.confirm({
      title: 'Eliminar lotería',
      message: `¿Eliminar la lotería "${lottery.name}" y todas sus ventas?`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await lotteryAdminApi.remove(lottery.id);
      await loadLotteries();
    } catch (deleteError) {
      await dialog.alert({
        title: 'No se pudo eliminar',
        message:
          deleteError instanceof Error ? deleteError.message : 'Error al eliminar la lotería',
        variant: 'danger',
      });
    }
  };

  const handleEditLottery = (lottery: Lottery) => {
    setEditingLottery(lottery);
    setFormData({
      club_id: lottery.club_id,
      name: lottery.name,
      description: lottery.description || '',
      draw_date: lottery.draw_date ? lottery.draw_date.split('T')[0] : '',
      ticket_price: Number(lottery.ticket_price),
      donation_per_ticket: Number(lottery.donation_per_ticket ?? 0),
      start_number: Number(lottery.start_number ?? 1),
      num_tacos: Number(lottery.num_tacos ?? 1),
      tickets_per_taco: Number(lottery.tickets_per_taco ?? 25),
      lottery_numbers: [
        lottery.lottery_number_1 || lottery.lottery_number?.split('-')[0] || '',
        lottery.lottery_number_2 || lottery.lottery_number?.split('-')[1] || '',
      ],
      auto_assign: false,
      team_id: '',
    });
    setShowForm(true);
  };

  const handleUpdateLottery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingLottery) return;
    setSaving(true);
    setError('');
    try {
      await lotteryAdminApi.update({
        lotteryId: editingLottery.id,
        name: formData.name,
        description: formData.description,
        drawDate: formData.draw_date || undefined,
        lotteryNumber1: formData.lottery_numbers[0],
        lotteryNumber2: formData.lottery_numbers[1],
      });
      await loadLotteries();
      closeForm();
      await dialog.alert({
        title: 'Lotería actualizada',
        message: 'Lotería actualizada correctamente.',
        variant: 'success',
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Error al actualizar la lotería');
    } finally {
      setSaving(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLottery(null);
    setFormData(emptyForm);
    setError('');
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
            <p className="text-gray-600">Ventas, tacos y liquidación de jugadores</p>
          </div>
          <button
            onClick={() => { setEditingLottery(null); setShowForm(true); }}
            className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + Nueva Lotería
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            <p>{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-2 text-sm font-bold underline"
            >
              Volver a iniciar sesión
            </button>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">{editingLottery ? 'Editar Lotería' : 'Nueva Lotería'}</h2>
            <form onSubmit={editingLottery ? handleUpdateLottery : handleCreateLottery} className="space-y-4">
              {!editingLottery && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Club *</label>
                  <select
                    value={formData.club_id}
                    onChange={(event) => setFormData({ ...formData, club_id: event.target.value, team_id: '' })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Seleccionar club...</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>{club.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número sorteo 1</label>
                    <input
                      type="text"
                      value={formData.lottery_numbers[0]}
                      onChange={(event) => setFormData({ ...formData, lottery_numbers: [event.target.value, formData.lottery_numbers[1]] })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                      placeholder="ej: 91693"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número sorteo 2</label>
                    <input
                      type="text"
                      value={formData.lottery_numbers[1]}
                      onChange={(event) => setFormData({ ...formData, lottery_numbers: [formData.lottery_numbers[0], event.target.value] })}
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
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>

              {!editingLottery && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de sorteo</label>
                      <input
                        type="date"
                        value={formData.draw_date}
                        onChange={(event) => setFormData({ ...formData, draw_date: event.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número inicial papeleta</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.start_number}
                        onChange={(event) => setFormData({ ...formData, start_number: parseInt(event.target.value, 10) || 0 })}
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
                        onChange={(event) => setFormData({ ...formData, num_tacos: parseInt(event.target.value, 10) || 1 })}
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
                        onChange={(event) => setFormData({ ...formData, tickets_per_taco: parseInt(event.target.value, 10) || 1 })}
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
                        onChange={(event) => setFormData({ ...formData, ticket_price: parseFloat(event.target.value) || 0 })}
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
                        onChange={(event) => setFormData({ ...formData, donation_per_ticket: parseFloat(event.target.value) || 0 })}
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
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={formData.auto_assign}
                        onChange={(event) => setFormData({ ...formData, auto_assign: event.target.checked })}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="font-medium text-gray-700">Asignar tacos automáticamente</span>
                        <span className="block text-sm text-gray-500">
                          Reparte los tacos disponibles entre los jugadores activos del club.
                        </span>
                      </span>
                    </label>
                    {formData.auto_assign && teams.length > 0 && (
                      <select
                        value={formData.team_id}
                        onChange={(event) => setFormData({ ...formData, team_id: event.target.value })}
                        className="mt-3 w-full p-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Todos los jugadores del club</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-bold text-gray-700 mb-2">Vista previa de tacos</h3>
                    <div className="text-sm text-gray-600 max-h-32 overflow-y-auto">
                      {Array.from({ length: Math.min(formData.num_tacos, 20) }, (_, index) => {
                        const tacoStart = formData.start_number + index * formData.tickets_per_taco;
                        const tacoEnd = tacoStart + formData.tickets_per_taco - 1;
                        return (
                          <div key={index} className="flex justify-between py-1 border-b border-gray-200">
                            <span>Taco {index + 1}</span>
                            <span className="font-mono">{tacoStart.toString().padStart(4, '0')} - {tacoEnd.toString().padStart(4, '0')}</span>
                          </div>
                        );
                      })}
                      {formData.num_tacos > 20 && (
                        <div className="text-center py-2 text-gray-500">... y {formData.num_tacos - 20} tacos más</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingLottery ? 'Guardar Cambios' : 'Crear Lotería'}
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
              {lotteries.map((lottery) => (
                <div key={lottery.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800">{lottery.name}</h3>
                      {lottery.description && <p className="text-gray-600 text-sm">{lottery.description}</p>}
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                        <span>💰 {Number(lottery.ticket_price).toFixed(2)}€</span>
                        <span>🎫 {lottery.total_tickets} papeletas</span>
                        <span>✅ {lottery.stats?.sold ?? 0} vendidas</span>
                        <span>🔵 {lottery.stats?.available ?? 0} disponibles</span>
                        <span>💶 {(lottery.stats?.revenue ?? 0).toFixed(2)}€</span>
                        {lottery.draw_date && <span>📅 {new Date(lottery.draw_date).toLocaleDateString('es-ES')}</span>}
                        {lottery.lottery_number && <span>🔢 #{lottery.lottery_number}</span>}
                        <span className={lottery.sales_status === 'open' ? 'text-green-600' : 'text-orange-600'}>
                          {lottery.sales_status === 'open' ? 'Venta abierta' : 'Venta cerrada'}
                        </span>
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
                        onClick={() => handleDeleteLottery(lottery)}
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
