<script lang="ts">
  import { ShoppingCart } from "@lucide/svelte";
  import { STATUS_CHART_COLORS, statusLabel } from "$lib/constants/orders.js";
  import type { Stats } from "$lib/types/dashboard.js";

  interface Props {
    stats: Stats;
  }

  let { stats }: Props = $props();

  const totalOrdersForBar = $derived(
    Object.values(stats.ordersByStatus).reduce((a, b) => a + b, 0),
  );
</script>

<div class="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
  <div class="flex items-center justify-between mb-5">
    <h2 class="text-sm font-bold text-gray-900">Orders by Status</h2>
    <a
      href="/admin/orders"
      class="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
      >View all →</a
    >
  </div>

  {#if totalOrdersForBar === 0}
    <div
      class="flex flex-col items-center justify-center h-28 text-gray-300 gap-2"
    >
      <ShoppingCart class="w-8 h-8" />
      <p class="text-sm font-medium">No orders yet</p>
    </div>
  {:else}
    <!-- Stacked bar -->
    <div class="flex rounded-full overflow-hidden h-2.5 mb-5 gap-px">
      {#each Object.entries(stats.ordersByStatus) as [status, n]}
        <div
          class="{STATUS_CHART_COLORS[status] ??
            'bg-gray-300'} transition-all"
          style="width: {(n / totalOrdersForBar) * 100}%"
          title="{statusLabel(status)}: {n}"
        ></div>
      {/each}
    </div>

    <div class="space-y-2.5">
      {#each Object.entries(stats.ordersByStatus).sort((a, b) => b[1] - a[1]) as [status, n]}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full shrink-0 {STATUS_CHART_COLORS[
                status
              ] ?? 'bg-gray-300'}"
            ></span>
            <span class="text-xs font-medium text-gray-600"
              >{statusLabel(status)}</span
            >
          </div>
          <div class="flex items-center gap-2">
            <div
              class="w-16 bg-gray-50 rounded-full h-1.5 overflow-hidden"
            >
              <div
                class="{STATUS_CHART_COLORS[status] ??
                  'bg-gray-300'} h-full rounded-full"
                style="width: {(n / totalOrdersForBar) * 100}%"
              ></div>
            </div>
            <span class="text-xs font-bold text-gray-700 w-5 text-right"
              >{n}</span
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
