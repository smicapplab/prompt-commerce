export interface TrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface RecentOrder {
  id: number;
  buyer_ref: string | null;
  channel: string;
  status: string;
  total: number | null;
  created_at: string;
}

export interface TopProduct {
  title: string;
  units_sold: number;
  revenue: number;
}

export interface Stats {
  products: number;
  categories: number;
  promotions: number;
  reviews: number;
  orders: number;
  conversations: number;
  revenueTotal: number;
  revenueThisMonth: number;
  revenueThisWeek: number;
  revenueToday: number;
  ordersThisMonth: number;
  ordersPending: number;
  ordersByStatus: Record<string, number>;
  revenueTrend: TrendPoint[];
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
}
