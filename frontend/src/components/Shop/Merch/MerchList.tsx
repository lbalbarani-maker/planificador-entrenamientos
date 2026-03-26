import React, { useState, useEffect } from 'react';
import { merchApi } from '../../../lib/supabaseShop';
import { MerchProduct } from '../../../types/shop';
import { MERCH_CATEGORIES } from '../../../types/shop';

const MerchList: React.FC = () => {
  const [products, setProducts] = useState<MerchProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const data = await merchApi.getProducts();
    setProducts(data);
    setLoading(false);
  };

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category === selectedCategory);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);
  };

  const getWhatsAppLink = (product: MerchProduct) => {
    const message = encodeURIComponent(
      `¡Hola! Me interesa comprar ${product.name} (${formatPrice(product.price)}) de la tienda oficial del club.`
    );
    return `https://wa.me/34XXXXXXXXX?text=${message}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Merchandising Oficial</h2>
        <p className="text-sm text-gray-500">Productos oficiales del Club Sanse Complutense</p>
      </div>

      {/* Categories */}
      {products.length > 0 && (
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
          {MERCH_CATEGORIES.map(cat => (
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
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sanse-blue" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl">
          <div className="text-4xl mb-3">👕</div>
          <h3 className="text-lg font-medium text-gray-900">Próximamente</h3>
          <p className="text-gray-500 text-sm mt-1">
            Aún no hay productos disponibles en la tienda oficial
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm overflow-hidden"
            >
              {/* Image */}
              <div className="aspect-[4/3] bg-gray-100 relative">
                {product.images && product.images[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    {MERCH_CATEGORIES.find(c => c.id === product.category)?.icon || '👕'}
                  </div>
                )}
                {product.stock === 0 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full font-medium">
                      Agotado
                    </span>
                  </div>
                )}
                {product.stock > 0 && product.stock <= 5 && (
                  <span className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    ¡Últimas unidades!
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900">{product.name}</h3>
                {product.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                )}
                <p className="text-sanse-blue font-bold text-lg mt-2">{formatPrice(product.price)}</p>
                
                {product.stock > 0 && (
                  <a
                    href={getWhatsAppLink(product)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-xl font-medium hover:bg-green-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.511-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.884 9.884m8.413-18.171A11.745 11.745 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.482-8.416Z"/>
                    </svg>
                    Pedir por WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <p className="font-medium">¿Cómo comprar?</p>
            <p className="mt-1">
              Contacta con el club por WhatsApp para realizar tu pedido. Recibirás indicaciones sobre formas de pago y entrega.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchList;