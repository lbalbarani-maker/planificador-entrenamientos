import React, { useState, useEffect } from 'react';
import { clubsApi, fieldsApi } from '../../lib/supabaseTeams';
import { supabase } from '../../lib/supabase';
import { Club, Field } from '../../types/teams';
import BackButton from '../BackButton';

const ClubsList: React.FC = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClubForm, setShowClubForm] = useState(false);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [viewingClub, setViewingClub] = useState<Club | null>(null);
  const [deletingClub, setDeletingClub] = useState<Club | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedClub, setSelectedClub] = useState<string>('');

  const [clubForm, setClubForm] = useState({
    name: '',
    logo_url: '',
    primary_color: '#1E40AF',
    secondary_color: '#FFFFFF',
    address: '',
    google_maps_url: '',
    website: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [fieldForm, setFieldForm] = useState({
    name: '',
    address: '',
    google_maps_url: '',
    surface: 'hierba' as 'hierba' | 'sala',
    has_parking: false,
    has_locker_rooms: false,
    notes: ''
  });
  const [editingField, setEditingField] = useState<Field | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('=== DEBUG loadData ===');
      const [clubsData, fieldsData] = await Promise.all([
        clubsApi.getClubs(),
        fieldsApi.getFields()
      ]);
      console.log('Clubs cargados:', clubsData);
      console.log('Campos/Pistas cargados:', fieldsData);
      setClubs(clubsData);
      setFields(fieldsData);
    } catch (error: any) {
      console.error('=== ERROR loading data ===');
      console.error('Error completo:', error);
      console.error('Mensaje:', error?.message);
      alert(`Error al cargar datos: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadLogo = async (file: File): Promise<string | null> => {
    try {
      console.log('=== DEBUG uploadLogo ===');
      console.log('File:', file.name, file.size, file.type);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `logos/${fileName}`;
      console.log('FilePath:', filePath);

      const { data, error: uploadError } = await supabase.storage
        .from('Public bucket')
        .upload(filePath, file);

      console.log('Upload response - data:', data, 'error:', uploadError);

      if (uploadError) {
        console.error('Error uploading logo:', uploadError);
        alert(`Error al subir logo: ${uploadError.message}`);
        return null;
      }

      const { data: urlData } = supabase.storage.from('Public bucket').getPublicUrl(filePath);
      console.log('Public URL:', urlData?.publicUrl);
      return urlData?.publicUrl || null;
    } catch (error: any) {
      console.error('Error uploading logo (catch):', error);
      alert(`Error al subir logo: ${error?.message || error}`);
      return null;
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.match(/image\/(jpeg|png|jpg)/)) {
        alert('Solo se permiten archivos JPG o PNG');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('El archivo no puede superar 2MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveClub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('=== DEBUG: Guardando club ===');
      console.log('clubForm:', clubForm);
      console.log('logoFile:', logoFile);
      
      let logoUrl = clubForm.logo_url;

      if (logoFile) {
        console.log('Subiendo logo...');
        const uploadedUrl = await uploadLogo(logoFile);
        console.log('Logo subido, URL:', uploadedUrl);
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      const clubData = { ...clubForm, logo_url: logoUrl };
      console.log('Datos a guardar:', clubData);

      if (editingClub) {
        console.log('Actualizando club existente:', editingClub.id);
        await clubsApi.updateClub(editingClub.id, clubData);
        setSuccessMessage('Club actualizado con éxito');
        setShowSuccessModal(true);
      } else {
        console.log('Creando nuevo club...');
        await clubsApi.createClub(clubData);
        setSuccessMessage('Club creado con éxito');
        setShowSuccessModal(true);
      }
      await loadData();
      resetClubForm();
      console.log('Club guardado exitosamente');
    } catch (error: any) {
      console.error('=== ERROR saving club ===');
      console.error('Error completo:', error);
      console.error('Mensaje:', error?.message);
      console.error('Detalles:', error?.details);
      console.error('Hint:', error?.hint);
      alert(`Error al guardar club: ${error?.message || error}`);
    }
  };

  const handleDeleteClub = async (id: string) => {
    setDeletingClub(clubs.find(c => c.id === id) || null);
  };

  const confirmDeleteClub = async () => {
    if (!deletingClub) return;
    try {
      await clubsApi.deleteClub(deletingClub.id);
      await loadData();
      setDeletingClub(null);
      setSuccessMessage('Club eliminado con éxito');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error deleting club:', error);
      alert('Error al eliminar club');
    }
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub) {
      alert('Selecciona un club primero');
      return;
    }
    try {
      console.log('=== DEBUG handleSaveField ===');
      console.log('selectedClub:', selectedClub);
      console.log('editingField:', editingField);
      console.log('fieldForm:', fieldForm);
      
      const fieldData = {
        club_id: selectedClub,
        name: fieldForm.name,
        address: fieldForm.address || undefined,
        google_maps_url: fieldForm.google_maps_url || undefined,
        surface: fieldForm.surface,
        has_parking: fieldForm.has_parking,
        has_locker_rooms: fieldForm.has_locker_rooms,
        notes: fieldForm.notes || undefined
      };
      console.log('fieldData a guardar:', fieldData);
      
      let result;
      if (editingField) {
        console.log('Actualizando pista existente:', editingField.id);
        result = await fieldsApi.updateField(editingField.id, fieldData);
        console.log('Field actualizado:', result);
      } else {
        console.log('Creando nueva pista...');
        result = await fieldsApi.createField(fieldData);
        console.log('Field creado:', result);
      }
      
      await loadData();
      resetFieldForm();
      console.log('Pista guardada exitosamente');
    } catch (error: any) {
      console.error('=== ERROR saving field ===');
      console.error('Error completo:', error);
      console.error('Mensaje:', error?.message);
      alert(`Error al guardar pista: ${error?.message || error}`);
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!window.confirm('¿Eliminar esta pista?')) return;
    try {
      await fieldsApi.deleteField(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Error al eliminar pista');
    }
  };

  const resetClubForm = () => {
    setClubForm({
      name: '',
      logo_url: '',
      primary_color: '#1E40AF',
      secondary_color: '#FFFFFF',
      address: '',
      google_maps_url: '',
      website: ''
    });
    setLogoFile(null);
    setLogoPreview(null);
    setEditingClub(null);
    setShowClubForm(false);
  };

  const resetFieldForm = () => {
    setFieldForm({
      name: '',
      address: '',
      google_maps_url: '',
      surface: 'hierba',
      has_parking: false,
      has_locker_rooms: false,
      notes: ''
    });
    setEditingField(null);
    setShowFieldForm(false);
  };

  const editClub = (club: Club) => {
    setClubForm({
      name: club.name,
      logo_url: club.logo_url || '',
      primary_color: club.primary_color || '#1E40AF',
      secondary_color: club.secondary_color || '#FFFFFF',
      address: club.address || '',
      google_maps_url: club.google_maps_url || '',
      website: club.website || ''
    });
    setLogoFile(null);
    setLogoPreview(club.logo_url || null);
    setEditingClub(club);
    setShowClubForm(true);
  };

  const clubFields = fields.filter(f => f.club_id === selectedClub);

  const generateGoogleMapsUrl = (address: string) => {
    if (!address) return '';
    const encoded = encodeURIComponent(address);
    return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">🏢 Gestión de Clubes</h1>
          </div>
        </div>

        {/* Clubes */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Clubes</h2>
            <button
              onClick={() => setShowClubForm(true)}
              className="bg-sanse-blue text-white px-4 py-2 rounded-xl hover:bg-blue-700"
            >
              + Nuevo Club
            </button>
          </div>

          {clubs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay clubes</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clubs.map(club => (
                <div key={club.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  {club.logo_url ? (
                    <img src={club.logo_url} alt={club.name} className="w-12 h-12 rounded-lg object-contain bg-white" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-sanse-blue/10 flex items-center justify-center text-2xl">
                      🏢
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{club.name}</p>
                    {club.address && (
                      <p className="text-xs text-gray-500 truncate">{club.address}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setViewingClub(club)}
                      className="bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 text-sm"
                      title="Ver detalles"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => { editClub(club); setSelectedClub(club.id); }}
                      className="bg-sanse-blue text-white px-2 py-1 rounded hover:bg-blue-700 text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteClub(club.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pistas - MOVED TO /locations */}
        {false && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Pistas de Hockey</h2>
            <button
              onClick={() => setShowFieldForm(true)}
              disabled={!selectedClub}
              className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              + Nueva Pista
            </button>
          </div>

          {!selectedClub ? (
            <p className="text-gray-500 text-center py-4">Selecciona un club para ver sus pistas</p>
          ) : clubFields.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay pistas para este club</p>
          ) : (
            <div className="space-y-3">
              {clubFields.map(field => (
                <div key={field.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                    field.surface === 'sala' ? 'bg-purple-100' : 'bg-green-100'
                  }`}>
                    {field.surface === 'sala' ? '🏟️' : '🌱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{field.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        field.surface === 'sala' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {field.surface === 'sala' ? 'Sala' : 'Hierba'}
                      </span>
                    </div>
                    {field.address && (
                      <p className="text-xs text-gray-500 truncate">{field.address}</p>
                    )}
                  </div>
                  {field.google_maps_url && (
                    <a
                      href={field.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Ver en Google Maps"
                    >
                      📍
                    </a>
                  )}
                  <button
                    onClick={() => { setEditingField(field); setFieldForm({
                      name: field.name,
                      address: field.address || '',
                      google_maps_url: field.google_maps_url || '',
                      surface: field.surface as 'hierba' | 'sala',
                      has_parking: field.has_parking,
                      has_locker_rooms: field.has_locker_rooms,
                      notes: field.notes || ''
                    }); setShowFieldForm(true); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteField(field.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Modal Club */}
        {showClubForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">
                {editingClub ? 'Editar Club' : 'Nuevo Club'}
              </h3>
              <form onSubmit={handleSaveClub} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={clubForm.name}
                    onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm">Subir imagen</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="text-xs text-gray-500">JPG o PNG (max 2MB)</span>
                    </div>
                    {(logoPreview || clubForm.logo_url) && (
                      <div className="relative inline-block">
                        <img
                          src={logoPreview || clubForm.logo_url}
                          alt="Logo preview"
                          className="w-16 h-16 object-contain bg-white rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => { setLogoFile(null); setLogoPreview(null); setClubForm({ ...clubForm, logo_url: '' }); }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">O usa URL</label>
                  <input
                    type="url"
                    value={clubForm.logo_url}
                    onChange={(e) => { setLogoFile(null); setLogoPreview(null); setClubForm({ ...clubForm, logo_url: e.target.value }); }}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color Principal</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={clubForm.primary_color}
                        onChange={(e) => setClubForm({ ...clubForm, primary_color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={clubForm.primary_color}
                        onChange={(e) => setClubForm({ ...clubForm, primary_color: e.target.value })}
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color Secundario</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={clubForm.secondary_color}
                        onChange={(e) => setClubForm({ ...clubForm, secondary_color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={clubForm.secondary_color}
                        onChange={(e) => setClubForm({ ...clubForm, secondary_color: e.target.value })}
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={clubForm.address}
                    onChange={(e) => setClubForm({ 
                      ...clubForm, 
                      address: e.target.value,
                      google_maps_url: generateGoogleMapsUrl(e.target.value)
                    })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="Calle, ciudad..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps URL</label>
                  <input
                    type="url"
                    value={clubForm.google_maps_url}
                    onChange={(e) => setClubForm({ ...clubForm, google_maps_url: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="https://goo.gl/maps/..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se autocompletará al escribir la dirección
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Web</label>
                  <input
                    type="url"
                    value={clubForm.website}
                    onChange={(e) => setClubForm({ ...clubForm, website: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    {editingClub ? 'Guardar' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={resetClubForm}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Ver Club */}
        {viewingClub && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Detalles del Club</h3>
                <button
                  onClick={() => setViewingClub(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                {viewingClub.logo_url && (
                  <div className="flex justify-center">
                    <img 
                      src={viewingClub.logo_url} 
                      alt={viewingClub.name} 
                      className="w-24 h-24 object-contain rounded-xl border-2 border-gray-200"
                    />
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-semibold text-gray-800">{viewingClub.name}</p>
                </div>

                {(viewingClub.primary_color || viewingClub.secondary_color) && (
                  <div>
                    <p className="text-sm text-gray-500">Colores</p>
                    <div className="flex items-center gap-2 mt-1">
                      {viewingClub.primary_color && (
                        <div 
                          className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-sm" 
                          style={{ backgroundColor: viewingClub.primary_color }}
                          title="Color principal"
                        />
                      )}
                      {viewingClub.secondary_color && (
                        <div 
                          className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-sm" 
                          style={{ backgroundColor: viewingClub.secondary_color }}
                          title="Color secundario"
                        />
                      )}
                    </div>
                  </div>
                )}

                {viewingClub.address && (
                  <div>
                    <p className="text-sm text-gray-500">Dirección</p>
                    <p className="text-gray-800">{viewingClub.address}</p>
                  </div>
                )}

                {viewingClub.google_maps_url && (
                  <div>
                    <p className="text-sm text-gray-500">Google Maps</p>
                    <a
                      href={viewingClub.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sanse-blue hover:underline flex items-center gap-1"
                    >
                      Ver ubicación
                      <span className="text-xs">📍</span>
                    </a>
                  </div>
                )}

                {viewingClub.website && (
                  <div>
                    <p className="text-sm text-gray-500">Web</p>
                    <a
                      href={viewingClub.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sanse-blue hover:underline flex items-center gap-1"
                    >
                      Visitar web
                      <span className="text-xs">🌐</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setViewingClub(null)}
                  className="w-full bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Éxito */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{successMessage}</h3>
              </div>
              <div className="mt-6">
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full bg-sanse-blue text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Eliminar Club */}
        {deletingClub && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">¿Eliminar este club?</h3>
                <p className="text-gray-600 mb-2">
                  Se eliminarán todos sus equipos y jugadores.
                </p>
                <p className="text-sm text-gray-500 font-medium">
                  {deletingClub.name}
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeletingClub(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteClub}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Pista */}
        {showFieldForm && selectedClub && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
              <h3 className="text-xl font-bold mb-4">{editingField ? 'Editar Pista' : 'Nueva Pista'}</h3>
              <form onSubmit={handleSaveField} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={fieldForm.name}
                    onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="Pista principal, Campo 2..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Superficie *</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="surface"
                        value="hierba"
                        checked={fieldForm.surface === 'hierba'}
                        onChange={(e) => setFieldForm({ ...fieldForm, surface: 'hierba' })}
                        className="text-green-600"
                      />
                      <span className="flex items-center gap-1">
                        🌱 Hierba
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="surface"
                        value="sala"
                        checked={fieldForm.surface === 'sala'}
                        onChange={(e) => setFieldForm({ ...fieldForm, surface: 'sala' })}
                        className="text-purple-600"
                      />
                      <span className="flex items-center gap-1">
                        🏟️ Sala
                      </span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={fieldForm.address}
                    onChange={(e) => setFieldForm({ 
                      ...fieldForm, 
                      address: e.target.value,
                      google_maps_url: generateGoogleMapsUrl(e.target.value)
                    })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="Calle, ciudad..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps</label>
                  <input
                    type="url"
                    value={fieldForm.google_maps_url}
                    onChange={(e) => setFieldForm({ ...fieldForm, google_maps_url: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="https://goo.gl/maps/..."
                  />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldForm.has_parking}
                      onChange={(e) => setFieldForm({ ...fieldForm, has_parking: e.target.checked })}
                      className="rounded text-sanse-blue"
                    />
                    <span>🅿️ Parking</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldForm.has_locker_rooms}
                      onChange={(e) => setFieldForm({ ...fieldForm, has_locker_rooms: e.target.checked })}
                      className="rounded text-sanse-blue"
                    />
                    <span>🚿 Vestuarios</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={fieldForm.notes}
                    onChange={(e) => setFieldForm({ ...fieldForm, notes: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                  >
                    {editingField ? 'Guardar Cambios' : 'Crear Pista'}
                  </button>
                  <button
                    type="button"
                    onClick={resetFieldForm}
                    className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubsList;
