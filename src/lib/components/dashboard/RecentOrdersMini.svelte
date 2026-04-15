<script lang="ts">
  import { ShoppingCart, ArrowUpRight } from "@lucide/svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import { STATUS_COLORS, statusLabel } from "$lib/constants/orders.js";
  import { formatCurrency, relativeTime } from "$lib/utils/format.js";
  import type { RecentOrder } from "$lib/types/dashboard.js";

  interface Props {
    recentOrders: RecentOrder[];
  }

  let { recentOrders }: Props = $props();
</script>

<Card
  class="lg:col-span-2 shadow-sm overflow-hidden p-0"
>
  <div
    class="px-6 py-4 border-b border-gray-50 flex items-center justify-between"
  >
    <h2 class="text-sm font-bold text-gray-900">Recent Orders</h2>
    <Button
      href="/admin/orders"
      variant="secondary"
      size="sm"
      class="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors border-none p-0 h-auto"
    >
      All orders <ArrowUpRight class="w-3 h-3 ml-1" />
    </Button>
  </div>

  {#if recentOrders.length === 0}
    <div class="py-16 flex flex-col items-center gap-2 text-gray-300">
      <ShoppingCart class="w-8 h-8" />
      <p class="text-sm font-medium">No orders yet</p>
    </div>
  {:else}
    <div class="divide-y divide-gray-50">
      {#each recentOrders as o}
        <a
          href="/admin/orders/{o.id}"
          class="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors group"
        >
          <Badge
            class="font-mono text-indigo-500 bg-indigo-50 border-none font-bold"
          >
            #{String(o.id).padStart(5, "0")}
          </Badge>
          <div class="flex-1 min-w-0">
            <p
              class="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors"
            >
              {o.buyer_ref ?? "Guest Buyer"}
            </p>
            <p
              class="text-[10px] text-gray-400 uppercase tracking-wide font-bold"
            >
              {o.channel}
            </p>
          </div>
          <Badge
            class="px-2 py-0.5 border {STATUS_COLORS[o.status] ?? 'bg-gray-50 border-gray-100 text-gray-600'} flex-shrink-0"
          >
            {statusLabel(o.status)}
          </Badge>
          <span
            class="text-sm font-black text-gray-900 flex-shrink-0 w-20 text-right"
          >
            {formatCurrency(o.total)}
          </span>
          <span
            class="text-[10px] text-gray-400 flex-shrink-0 w-14 text-right"
            >{relativeTime(o.created_at)}</span
          >
        </a>
      {/each}
    </div>
  {/if}
</Card>
