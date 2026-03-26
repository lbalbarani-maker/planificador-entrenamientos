import { supabase } from './supabase';
import { MarketplaceItem, MerchProduct, CreateMarketplaceItem, CreateMerchProduct } from '../types/shop';

const getCurrentUser = () => {
  const userData = localStorage.getItem('user');
  if (!userData) throw new Error('Usuario no autenticado');
  return JSON.parse(userData);
};

export const marketplaceApi = {
  async getItems(category?: string): Promise<MarketplaceItem[]> {
    let query = supabase
      .from('marketplace_items')
      .select('*, seller:profiles(id, full_name, phone)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching marketplace items:', error);
      return [];
    }
    return data || [];
  },

  async getMyItems(): Promise<MarketplaceItem[]> {
    const user = getCurrentUser();
    const { data, error } = await supabase
      .from('marketplace_items')
      .select('*, seller:profiles(id, full_name, phone)')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my items:', error);
      return [];
    }
    return data || [];
  },

  async getItem(id: string): Promise<MarketplaceItem | null> {
    const { data, error } = await supabase
      .from('marketplace_items')
      .select('*, seller:profiles(id, full_name, phone)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching item:', error);
      return null;
    }
    return data;
  },

  async createItem(input: CreateMarketplaceItem): Promise<MarketplaceItem> {
    const user = getCurrentUser();
    const { data, error } = await supabase
      .from('marketplace_items')
      .insert([{
        ...input,
        seller_id: user.id,
        club_id: user.club_id,
        status: 'active',
        images: input.images || [],
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateItem(id: string, input: Partial<CreateMarketplaceItem>): Promise<MarketplaceItem> {
    const { data, error } = await supabase
      .from('marketplace_items')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async markAsSold(id: string): Promise<void> {
    const { error } = await supabase
      .from('marketplace_items')
      .update({ status: 'sold', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('marketplace_items')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `marketplace/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('images').getPublicUrl(filePath);
    return data.publicUrl;
  },
};

export const merchApi = {
  async getProducts(): Promise<MerchProduct[]> {
    const user = getCurrentUser();
    const { data, error } = await supabase
      .from('merch_products')
      .select('*')
      .eq('club_id', user.club_id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching merch products:', error);
      return [];
    }
    return data || [];
  },

  async createProduct(input: CreateMerchProduct): Promise<MerchProduct> {
    const user = getCurrentUser();
    const { data, error } = await supabase
      .from('merch_products')
      .insert([{
        ...input,
        club_id: user.club_id,
        is_active: true,
        images: input.images || [],
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, input: Partial<CreateMerchProduct>): Promise<MerchProduct> {
    const { data, error } = await supabase
      .from('merch_products')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('merch_products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};