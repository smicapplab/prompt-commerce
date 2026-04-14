export interface StoreItem {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  gateway_key: string | null;
  active: number;
  created_at: string;
}
