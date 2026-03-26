export interface MarketplaceItem {
  id: string;
  title: string;
  description?: string;
  price: number;
  condition: 'new' | 'used';
  category: string;
  images: string[];
  seller_id: string;
  club_id: string;
  status: 'active' | 'sold' | 'deleted';
  created_at: string;
  updated_at: string;
  seller?: {
    id: string;
    full_name: string;
    phone?: string;
  };
}

export interface MerchProduct {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: string[];
  category?: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateMarketplaceItem {
  title: string;
  description?: string;
  price: number;
  condition: 'new' | 'used';
  category: string;
  images?: string[];
}

export interface CreateMerchProduct {
  name: string;
  description?: string;
  price: number;
  stock: number;
  images?: string[];
  category?: string;
}

export const MARKETPLACE_CATEGORIES = [
  { id: 'sticks', label: 'Palos', icon: '🏑' },
  { id: 'shoes', label: 'Zapatillas', icon: '👟' },
  { id: 'clothes', label: 'Ropa', icon: '👕' },
  { id: 'protection', label: 'Protecciones', icon: '🛡️' },
  { id: 'bags', label: 'Bolsas', icon: '🎒' },
  { id: 'other', label: 'Otros', icon: '📦' },
] as const;

export const MERCH_CATEGORIES = [
  { id: 'clothing', label: 'Ropa', icon: '👕' },
  { id: 'accessories', label: 'Accesorios', icon: '🧣' },
  { id: 'equipment', label: 'Equipamiento', icon: '🏑' },
] as const;