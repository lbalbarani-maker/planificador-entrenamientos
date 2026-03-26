import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketplaceApi } from '../../../lib/supabaseShop';
import { MarketplaceItem } from '../../../types/shop';
import { MARKETPLACE_CATEGORIES } from '../../../types/shop';

const MarketplaceList: React.FC = () => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    const data = await marketplaceApi.getItems();
    setItems(data);
    setLoading(false);
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Marketplace</h2>
          <p className="text-sm text-gray-500">Compra y vende material de segunda mano</p>
        </div>
        <button
          onClick={() => navigate('/shop/marketplace/new')}
          className="flex items-center gap-2 bg-sanse-blue text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Publicar
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar productos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-sanse-blue focus:border-transparent outline-none"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-sanse-blue text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-sanse-blue'
          }`}
        >
          Todos
        </button>
        {MARKETPLACE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              selectedCategory === cat.id
                ? 'bg-sanse-blue text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-sanse-blue'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sanse-blue" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl">
          <div className="text-4xl mb-3">📦</div>
          <h3 className="text-lg font-medium text-gray-900">No hay productos</h3>
          <p className="text-gray-500 text-sm mt-1">
            {searchQuery ? 'Prueba con otra búsqueda' : 'Sé el primero en publicar algo'}
          </p>
          <button
            onClick={() => navigate('/shop/marketplace/new')}
            className="mt-4 bg-sanse-blue text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700"
          >
            Publicar producto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(`/shop/marketplace/${item.id}`)}
              className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow text-left"
            >
              {/* Image */}
              <div className="aspect-[4/3] bg-gray-100 relative">
                {item.images && item.images[0] ? (
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    {MARKETPLACE_CATEGORIES.find(c => c.id === item.category)?.icon || '📦'}
                  </div>
                )}
                {item.condition === 'new' && (
                  <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    Nuevo
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                <p className="text-sanse-blue font-bold text-lg mt-1">{formatPrice(item.price)}</p>
                <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
                  <span>{item.seller?.full_name || 'Usuario'}</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplaceList;