import React, { useState } from 'react';

const SHOP_PASSWORD = 'complu6';
const SHOP_URL = 'https://www.futbolemotion.com/tiendas/palas-hockey';

const OfficialShop: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(SHOP_PASSWORD);
      setCopied(true);
      setTimeout(() => {
        window.open(SHOP_URL, '_blank');
      }, 500);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-sanse-blue to-blue-700 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center text-3xl">
            🏑
          </div>
          <div>
            <h2 className="text-xl font-bold">Tienda Oficial</h2>
            <p className="text-blue-100">Club Sanse Complutense</p>
          </div>
        </div>
        <p className="text-blue-100 text-sm">
          Accede a material oficial de hockey con descuentos exclusivos para miembros del club.
        </p>
      </div>

      {/* Access Card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mb-3">
            <span className="text-2xl">🔐</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Acceso Exclusivo Club</h3>
          <p className="text-gray-500 text-sm mt-1">
            Usa la contraseña del club para acceder a descuentos especiales
          </p>
        </div>

        {/* Password Display */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <label className="text-sm text-gray-500 mb-1 block">Contraseña</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={SHOP_PASSWORD}
              readOnly
              className="flex-1 bg-transparent text-xl font-mono font-bold text-gray-900 outline-none"
            />
            <button
              onClick={() => navigator.clipboard.writeText(SHOP_PASSWORD)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Copiar contraseña"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleCopyAndOpen}
          className={`w-full py-4 rounded-xl font-semibold transition-all ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-sanse-blue text-white hover:bg-blue-700'
          }`}
        >
          {copied ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              ¡Contraseña copiada!
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Copiar y Acceder a Tienda
            </span>
          )}
        </button>

        <p className="text-center text-gray-400 text-xs mt-3">
          Se abrirá una nueva pestaña con la tienda oficial
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏑</span>
            <div>
              <h4 className="font-semibold text-gray-900">Palos de Hockey</h4>
              <p className="text-sm text-gray-500">Las mejores marcas con descuentos exclusivos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">👟</span>
            <div>
              <h4 className="font-semibold text-gray-900">Calzado Deportivo</h4>
              <p className="text-sm text-gray-500">Zapatillas específicas para hockey</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h4 className="font-semibold text-gray-900">Protecciones</h4>
              <p className="text-sm text-gray-500">Equipamiento de seguridad certificado</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">👕</span>
            <div>
              <h4 className="font-semibold text-gray-900">Ropa y Accesorios</h4>
              <p className="text-sm text-gray-500">Camisetas, bolsos y más</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficialShop;