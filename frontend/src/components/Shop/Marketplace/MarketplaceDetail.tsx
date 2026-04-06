import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { marketplaceApi } from '../../../lib/supabaseShop';
import { MarketplaceItem } from '../../../types/shop';
import { MARKETPLACE_CATEGORIES } from '../../../types/shop';

const MarketplaceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'sold' | 'delete' | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) loadItem();
  }, [id]);

  const loadItem = async () => {
    setLoading(true);
    const data = await marketplaceApi.getItem(id!);
    setItem(data);
    setLoading(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const generateWhatsAppLink = () => {
    if (!item?.seller?.phone) return '#';
    const message = encodeURIComponent(
      `¡Hola! Vi tu anuncio "${item.title}" en el marketplace del club y me interesa. ¿Sigue disponible?`
    );
    const phone = item.seller.phone.replace(/\D/g, '');
    return `https://wa.me/${phone}?text=${message}`;
  };

  const handleMarkAsSold = () => {
    setConfirmAction('sold');
    setShowConfirmModal(true);
  };

  const handleDelete = () => {
    setConfirmAction('delete');
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (!item || !confirmAction) return;
    
    setConfirmLoading(true);
    try {
      if (confirmAction === 'sold') {
        await marketplaceApi.markAsSold(item.id);
      } else {
        await marketplaceApi.deleteItem(item.id);
      }
      setShowConfirmModal(false);
      navigate('/shop');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setConfirmLoading(false);
    }
  };

  const getConfirmTitle = () => confirmAction === 'sold' ? 'Marcar como vendido' : 'Eliminar producto';
  const getConfirmMessage = () => confirmAction === 'sold' 
    ? '¿Estás seguro de marcar este producto como vendido?' 
    : '¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.';
  const getConfirmButtonColor = () => confirmAction === 'sold' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sanse-blue" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">😕</div>
        <h3 className="text-lg font-medium text-gray-900">Producto no encontrado</h3>
        <button
          onClick={() => navigate('/shop')}
          className="mt-4 bg-sanse-blue text-white px-4 py-2 rounded-xl font-medium"
        >
          Volver
        </button>
      </div>
    );
  }

  const categoryLabel = MARKETPLACE_CATEGORIES.find(c => c.id === item.category)?.label || item.category;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwner = user.id === item.seller_id;

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/shop')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Detalle del producto</h1>
      </div>

      {/* Images */}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="aspect-[4/3] bg-gray-100 relative">
          {item.images && item.images.length > 0 ? (
            <>
              <img
                src={item.images[currentImage]}
                alt={item.title}
                className="w-full h-full object-cover"
              />
              {item.images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {item.images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImage(idx)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        currentImage === idx ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">
              {MARKETPLACE_CATEGORIES.find(c => c.id === item.category)?.icon || '📦'}
            </div>
          )}

          {item.condition === 'new' && (
            <span className="absolute top-3 left-3 bg-green-500 text-white text-sm px-3 py-1 rounded-full font-medium">
              Nuevo
            </span>
          )}
        </div>

        {item.images && item.images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {item.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImage(idx)}
                className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 ${
                  currentImage === idx ? 'border-sanse-blue' : 'border-transparent'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-sm text-gray-500">{categoryLabel}</span>
            <h2 className="text-xl font-bold text-gray-900 mt-1">{item.title}</h2>
          </div>
          <span className="text-2xl font-bold text-sanse-blue">{formatPrice(item.price)}</span>
        </div>

        {item.description && (
          <p className="text-gray-600 mt-3 whitespace-pre-wrap">{item.description}</p>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t text-sm text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-10a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Publicado {formatDate(item.created_at)}</span>
        </div>
      </div>

      {/* Seller */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Vendedor/a</h3>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sanse-blue/10 rounded-full flex items-center justify-center text-sanse-blue font-bold text-lg">
            {item.seller?.full_name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium text-gray-900">{item.seller?.full_name || 'Usuario'}</p>
            <p className="text-sm text-gray-500">Miembro del club</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        {isOwner ? (
          <div className="flex gap-2">
            <button
              onClick={handleMarkAsSold}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-xl font-medium hover:bg-green-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Marcar vendido
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center justify-center gap-2 bg-red-100 text-red-600 px-4 py-3 rounded-xl font-medium hover:bg-red-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ) : (
          <a
            href={generateWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-green-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.511-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.884 9.884m8.413-18.171A11.745 11.745 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.482-8.416Z"/>
            </svg>
            Contactar por WhatsApp
          </a>
        )}
      </div>

      {/* Modal de confirmación */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{getConfirmTitle()}</h3>
            <p className="text-gray-600 mb-6">{getConfirmMessage()}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleConfirm}
                disabled={confirmLoading}
                className={`${getConfirmButtonColor()} text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50`}
              >
                {confirmLoading ? 'Procesando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium"
                disabled={confirmLoading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceDetail;