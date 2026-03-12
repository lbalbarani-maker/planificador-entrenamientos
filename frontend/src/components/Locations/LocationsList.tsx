import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import BackButton from '../BackButton';

interface Location {
  id: string;
  name: string;
  address?: string;
  google_maps_url?: string;
  surface?: string[];
  has_parking?: boolean;
  has_locker_rooms?: boolean;
  notes?: string;
  is_active?: boolean;
  created_at: string;
}

const LocationsList: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [viewingLocation, setViewingLocation] = useState<Location | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    google_maps_url: '',
    surface: [] as string[],
    has_parking: false,
    has_locker_rooms: false,
    notes: '',
    is_active: true
  });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('locations')
          .update(formData)
          .eq('id', editingLocation.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('locations')
          .insert([formData]);
        
        if (error) throw error;
      }
      
      await loadLocations();
      resetForm();
      setSuccessMessage(editingLocation ? 'Pista actualizada correctamente' : 'Pista creada correctamente');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Error al guardar la pista');
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name || '',
      address: location.address || '',
      google_maps_url: location.google_maps_url || '',
      surface: location.surface || [],
      has_parking: location.has_parking || false,
      has_locker_rooms: location.has_locker_rooms || false,
      notes: location.notes || '',
      is_active: location.is_active !== false
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar esta pista?')) {
      try {
        const { error } = await supabase
          .from('locations')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        await loadLocations();
      } catch (error) {
        console.error('Error deleting location:', error);
        alert('Error al eliminar la pista');
      }
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingLocation(null);
    setFormData({
      name: '',
      address: '',
      google_maps_url: '',
      surface: [],
      has_parking: false,
      has_locker_rooms: false,
      notes: '',
      is_active: true
    });
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
            <h1 className="text-3xl font-bold text-sanse-blue">📍 Pistas</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-sanse-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + Nueva Pista
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">
              {editingLocation ? '✏️ Editar Pista' : '➕ Nueva Pista'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Superficie</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.surface.includes('hierba')}
                        onChange={(e) => {
                          const newSurface = e.target.checked
                            ? [...formData.surface, 'hierba']
                            : formData.surface.filter(s => s !== 'hierba');
                          setFormData({ ...formData, surface: newSurface });
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">🏟️ Hierba</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.surface.includes('sala')}
                        onChange={(e) => {
                          const newSurface = e.target.checked
                            ? [...formData.surface, 'sala']
                            : formData.surface.filter(s => s !== 'sala');
                          setFormData({ ...formData, surface: newSurface });
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">🏟️ Sala</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Maps</label>
                <input
                  type="url"
                  value={formData.google_maps_url}
                  onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  placeholder="https://maps.google.com/..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.has_parking}
                    onChange={(e) => setFormData({ ...formData, has_parking: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Aparcamiento</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.has_locker_rooms}
                    onChange={(e) => setFormData({ ...formData, has_locker_rooms: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Vestuarios</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  {editingLocation ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          {locations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay pistas creadas</p>
          ) : (
            <div className="space-y-4">
              {locations.map(location => (
                <div key={location.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800">{location.name}</h3>
                      {location.address && (
                        <p className="text-gray-600 text-sm">{location.address}</p>
                      )}
                      <div className="flex gap-3 mt-2 text-sm text-gray-500">
                        {location.surface?.includes('hierba') && <span>🏟️ Hierba</span>}
                        {location.surface?.includes('sala') && <span>🏟️ Sala</span>}
                        {location.has_parking && <span>🅿️ Parking</span>}
                        {location.has_locker_rooms && <span>🚿 Vestuarios</span>}
                      </div>
                      {location.google_maps_url && (
                        <a
                          href={location.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sanse-blue text-sm hover:underline"
                        >
                          📍 Ver en Google Maps
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewingLocation(location)}
                        className="bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 text-sm"
                        title="Ver detalles"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleEdit(location)}
                        className="bg-sanse-blue text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(location.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
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

        {/* Modal Ver Pista */}
        {viewingLocation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Detalles de la Pista</h3>
                <button
                  onClick={() => setViewingLocation(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-semibold text-gray-800">{viewingLocation.name}</p>
                </div>

                {viewingLocation.address && (
                  <div>
                    <p className="text-sm text-gray-500">Dirección</p>
                    <p className="text-gray-800">{viewingLocation.address}</p>
                  </div>
                )}

                {viewingLocation.surface && viewingLocation.surface.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500">Superficie</p>
                    <div className="flex gap-2 mt-1">
                      {viewingLocation.surface.includes('hierba') && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                          🏟️ Hierba
                        </span>
                      )}
                      {viewingLocation.surface.includes('sala') && (
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
                          🏟️ Sala
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {(viewingLocation.has_parking || viewingLocation.has_locker_rooms) && (
                  <div>
                    <p className="text-sm text-gray-500">Servicios</p>
                    <div className="flex gap-2 mt-1">
                      {viewingLocation.has_parking && (
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                          🅿️ Parking
                        </span>
                      )}
                      {viewingLocation.has_locker_rooms && (
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm">
                          🚿 Vestuarios
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {viewingLocation.google_maps_url && (
                  <div>
                    <p className="text-sm text-gray-500">Google Maps</p>
                    <a
                      href={viewingLocation.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sanse-blue hover:underline flex items-center gap-1"
                    >
                      Ver ubicación
                      <span className="text-xs">📍</span>
                    </a>
                  </div>
                )}

                {viewingLocation.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notas</p>
                    <p className="text-gray-800">{viewingLocation.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setViewingLocation(null)}
                  className="w-full bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">¡Éxito!</h3>
              <p className="text-gray-600 mb-6">{successMessage}</p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
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

export default LocationsList;
