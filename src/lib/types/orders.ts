import type { Product } from './catalog.js';

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
  buyer_name: string | null;
  buyer_email: string | null;
  delivery_address: string | null;
  channel: string;
  status: string;
  total: number | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
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

export const ORDER_STATUSES = [
  'pending_payment', 'pending', 'paid', 'picking', 'packing', 
  'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 
  'cancelled', 'refunded'
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending_payment': ['paid', 'cancelled'],
  'pending':         ['picking', 'cancelled', 'refunded'],
  'paid':            ['picking', 'cancelled', 'refunded'],
  'picking':         ['packing', 'cancelled', 'refunded'],
  'packing':         ['in_transit', 'ready_for_pickup', 'cancelled', 'refunded'],
  'in_transit':      ['delivered', 'cancelled', 'refunded'],
  'ready_for_pickup': ['picked_up', 'cancelled', 'refunded'],
  // Terminal statuses can only go to refunded
  'delivered':       ['refunded'],
  'picked_up':       ['refunded'],
  'cancelled':       [],
  'refunded':        [],
};

export type { Product };
