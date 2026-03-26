import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketplaceApi } from '../../../lib/supabaseShop';
import { MARKETPLACE_CATEGORIES } from '../../../types/shop';

const MarketplaceForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    condition: 'used' as 'new' | 'used',
    category: 'sticks',
    images: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'El título es obligatorio';
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = 'El precio debe ser mayor que 0';
    if (!formData.category) newErrors.category = 'Selecciona una categoría';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await marketplaceApi.createItem({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        price: parseFloat(formData.price),
        condition: formData.condition,
        category: formData.category,
        images: formData.images,
      });
      navigate('/shop');
    } catch (error) {
      console.error('Error creating item:', error);
      alert('Error al publicar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newImages: string[] = [];
      for (let i = 0; i < Math.min(files.length, 5 - formData.images.length); i++) {
        const url = await marketplaceApi.uploadImage(files[i]);
        newImages.push(url);
      }
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...newImages].slice(0, 5)
      }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Publicar producto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Images */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block font-medium text-gray-900 mb-2">Fotos (máx. 5)</label>
          
          {formData.images.length > 0 && (
            <div className="grid grid-cols-5 gap-2 mb-3">
              {formData.images.map((img, idx) => (
                <div key={idx} className="relative aspect-square">
                  <img
                    src={img}
                    alt={`Foto ${idx + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {formData.images.length < 5 && (
            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
              uploading ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-sanse-blue hover:bg-blue-50'
            }`}>
              {uploading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sanse-blue" />
              ) : (
                <>
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-500 mt-2">Añadir fotos</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploading || formData.images.length >= 5}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Title */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block font-medium text-gray-900 mb-2">Título *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Ej: Palo de hockey Adidas TX24"
            className={`w-full px-4 py-3 border rounded-xl outline-none transition-colors ${
              errors.title ? 'border-red-500' : 'border-gray-200 focus:border-sanse-blue'
            }`}
          />
          {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block font-medium text-gray-900 mb-2">Descripción</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe el estado del producto, talla, marca..."
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-sanse-blue resize-none"
          />
        </div>

        {/* Price */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block font-medium text-gray-900 mb-2">Precio *</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              placeholder="0.00"
              className={`w-full px-4 py-3 pr-10 border rounded-xl outline-none transition-colors ${
                errors.price ? 'border-red-500' : 'border-gray-200 focus:border-sanse-blue'
              }`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">€</span>
          </div>
          {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
        </div>

        {/* Condition */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block font-medium text-gray-900 mb-2">Estado</label>
          <div className="flex gap-2">
            {[
              { id: 'new', label: 'Nuevo', icon: '✨' },
              { id: 'used', label: 'Usado', icon: '📦' },
            ].map((cond) => (
              <button
                key={cond.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, condition: cond.id as 'new' | 'used' }))}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
                  formData.condition === cond.id
                    ? 'bg-sanse-blue text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{cond.icon}</span>
                <span>{cond.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block font-medium text-gray-900 mb-2">Categoría *</label>
          <div className="grid grid-cols-2 gap-2">
            {MARKETPLACE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                className={`flex items-center gap-2 p-3 rounded-xl font-medium transition-colors ${
                  formData.category === cat.id
                    ? 'bg-sanse-blue text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="text-sm">{cat.label}</span>
              </button>
            ))}
          </div>
          {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
        </div>

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full bg-sanse-blue text-white py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Publicando...
              </span>
            ) : (
              'Publicar producto'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MarketplaceForm;