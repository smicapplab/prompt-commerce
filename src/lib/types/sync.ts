export interface SyncStatus {
  dirty: number;
  products: number;
  categories: number;
  variants: number;
}

export interface SyncResult {
  upserted: { products: number; categories: number };
  deleted:  { products: number; categories: number };
}
