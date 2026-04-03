import type { Product } from './catalog';

export interface OrderItem {
  id?: number;
  product_id: number | null;
  title: string;
  price: number;
  quantity: number;
  product_title?: string | null;
  product_images?: string[];
}

export interface Order {
  id: number;
  buyer_ref: string | null;
  channel: string;
  status: string;
  total: number | null;
  notes: string | null;
  items: OrderItem[];
  item_count?: number;
  created_at: string;
  updated_at: string;
  delivery_type?: string;
  tracking_number?: string;
  courier_name?: string;
  tracking_url?: string;
  cancellation_reason?: string;
  payment_provider?: string;
  payment_instructions?: string;
}

export type { Product };
