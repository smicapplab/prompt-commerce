export interface StoreItem {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  gateway_key: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}
