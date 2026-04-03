export interface Product {
  id: number;
  sku: string | null;
  title: string;
  description: string | null;
  category_id: number | null;
  category_name?: string | null;
  price: number | null;
  stock_quantity: number;
  tags?: string[] | null;
  images?: string[] | null;
  active: boolean | number;
  created_at: string;
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
  active: boolean | number;
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
