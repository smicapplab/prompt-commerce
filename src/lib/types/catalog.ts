export interface Product {
  id: number;
  sku: string | null;
  title: string;
  description: string | null;
  category_id: number | null;
  category_name?: string | null;
  price: number | null;
  stock_quantity: number | null;
  track_inventory: boolean;
  product_type: 'generic' | 'wearable' | 'food' | 'device' | 'travel';
  metadata: Record<string, unknown>;
  variant_count?: number;
  min_price?: number;
  total_stock?: number;
  tags?: string[] | null;
  images?: string[] | null;
  active: boolean;
  is_synced?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  price: number;
  stock: number;
  images?: string[] | null;
  is_always_available: boolean;
  attributes: Record<string, string | number | boolean>;
  active: boolean;
  is_synced?: number;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  is_synced?: number;
  deleted_at?: string | null;
}

export interface Promotion {
  id: number;
  title: string;
  product_id: number | null;
  product_title?: string | null;
  voucher_code: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  is_synced?: number;
  deleted_at?: string | null;
  created_at: string;
}

export interface Review {
  id: number;
  product_id: number;
  product_title?: string | null;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}
