import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OfficialShop from './OfficialShop';
import MarketplaceList from './Marketplace/MarketplaceList';
import MerchList from './Merch/MerchList';
import { useRolePermissions } from '../../hooks/useRolePermissions';

const ShopMain: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'official' | 'marketplace' | 'merch'>('marketplace');
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useRolePermissions();

  const tabs = [
    { id: 'official' as const, label: 'Tienda Oficial', icon: '🛍️' },
    { id: 'marketplace' as const, label: 'Marketplace', icon: '🔄' },
    { id: 'merch' as const, label: 'Merch', icon: '🧣' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Volver</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Tienda</h1>
            <div className="w-16" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-sanse-blue text-sanse-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'official' && <OfficialShop />}
        {activeTab === 'marketplace' && <MarketplaceList />}
        {activeTab === 'merch' && <MerchList />}
      </div>
    </div>
  );
};

export default ShopMain;