<script lang="ts">
  import { TrendingUp, ShoppingCart, Clock, ArrowUpRight } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import Card from "$lib/components/ui/Card.svelte";
  import { formatCurrency, formatCompactCurrency } from "$lib/utils/format.js";
  import type { Stats } from "$lib/types/dashboard.js";

  interface Props {
    stats: Stats;
  }

  let { stats }: Props = $props();
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
  <!-- Revenue this month -->
  <Card
    class="bg-linear-to-br from-indigo-600 to-violet-600 border-none p-5 text-white shadow-lg shadow-indigo-100"
  >
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-bold text-indigo-100 uppercase tracking-wider">
        Revenue · Month
      </p>
      <TrendingUp class="w-4 h-4 text-indigo-300" />
    </div>
    <p class="text-2xl font-black tracking-tight">
      {formatCompactCurrency(stats.revenueThisMonth)}
    </p>
    <p class="text-xs text-indigo-200 mt-1.5 font-medium">
      All-time: {formatCompactCurrency(stats.revenueTotal)}
    </p>
  </Card>

  <!-- Revenue this week -->
  <Card
    class="p-5 hover:shadow-md transition-shadow"
  >
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">
        Revenue · Week
      </p>
      <div class="p-1.5 rounded-lg bg-blue-50 text-blue-500">
        <TrendingUp class="w-3.5 h-3.5" />
      </div>
    </div>
    <p class="text-2xl font-black text-gray-900 tracking-tight">
      {formatCompactCurrency(stats.revenueThisWeek)}
    </p>
    <p class="text-xs text-gray-400 mt-1.5">
      Today: {formatCompactCurrency(stats.revenueToday)}
    </p>
  </Card>

  <!-- Orders this month -->
  <Card
    class="p-5 hover:shadow-md transition-shadow"
  >
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">
        Orders · Month
      </p>
      <div class="p-1.5 rounded-lg bg-emerald-50 text-emerald-500">
        <ShoppingCart class="w-3.5 h-3.5" />
      </div>
    </div>
    <p class="text-2xl font-black text-gray-900 tracking-tight">
      {stats.ordersThisMonth}
    </p>
    <p class="text-xs text-gray-400 mt-1.5">Total: {stats.orders} orders</p>
  </Card>

  <!-- Pending / active orders -->
  <Card
    onclick={() => goto("/admin/orders")}
    class="p-5 hover:shadow-md transition-shadow group cursor-pointer"
  >
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">
        Active Orders
      </p>
      <div class="p-1.5 rounded-lg bg-amber-50 text-amber-500">
        <Clock class="w-3.5 h-3.5" />
      </div>
    </div>
    <p class="text-2xl font-black text-gray-900 tracking-tight">
      {stats.ordersPending}
    </p>
    <p
      class="text-xs text-gray-400 mt-1.5 flex items-center gap-1 group-hover:text-indigo-500 transition-colors"
    >
      View orders <ArrowUpRight class="w-3 h-3" />
    </p>
  </Card>
</div>
