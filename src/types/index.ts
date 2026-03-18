export interface Product {
  id: number;
  sku: string | null;
  title: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  price: number | null;
  tags: string[] | null;    // stored as JSON text in SQLite
  images: string[] | null;  // stored as JSON text in SQLite
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
}

export interface Promotion {
  id: number;
  title: string;
  product_id: number | null;
  voucher_code: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  created_at: string;
}

export interface Review {
  id: number;
  product_id: number;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

/** Raw SQLite row shapes (before JSON parsing) */
export interface ProductRow {
  id: number;
  sku: string | null;
  title: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  price: number | null;
  tags: string | null;
  images: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}
