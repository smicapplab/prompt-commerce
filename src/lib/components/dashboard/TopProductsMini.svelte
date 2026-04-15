<script lang="ts">
  import { Package } from "@lucide/svelte";
  import { formatCompactCurrency } from "$lib/utils/format.js";
  import type { TopProduct } from "$lib/types/dashboard.js";

  interface Props {
    topProducts: TopProduct[];
  }

  let { topProducts }: Props = $props();

  const maxUnits = $derived(
    Math.max(...topProducts.map((p) => p.units_sold), 1)
  );
</script>

<div
  class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
>
  <div class="px-6 py-4 border-b border-gray-50">
    <h2 class="text-sm font-bold text-gray-900">Top Products</h2>
  </div>
  {#if topProducts.length === 0}
    <div class="py-10 flex flex-col items-center gap-2 text-gray-300">
      <Package class="w-7 h-7" />
      <p class="text-xs font-medium">No sales data yet</p>
    </div>
  {:else}
    <div class="divide-y divide-gray-50">
      {#each topProducts as p, i}
        <div class="px-6 py-3.5">
          <div class="flex items-center gap-2 mb-1.5">
            <span
              class="text-[10px] font-black text-gray-300 w-4 flex-shrink-0"
              >#{i + 1}</span
            >
            <p
              class="text-sm font-bold text-gray-900 truncate flex-1"
              title={p.title}
            >
              {p.title}
            </p>
            <span class="text-xs font-bold text-gray-500 flex-shrink-0"
              >{p.units_sold} sold</span
            >
          </div>
          <div class="flex items-center gap-2 pl-6">
            <div
              class="flex-1 bg-gray-50 rounded-full h-1.5 overflow-hidden"
            >
              <div
                class="bg-indigo-400 h-full rounded-full transition-all duration-500"
                style="width: {(p.units_sold / maxUnits) * 100}%"
              ></div>
            </div>
            <span
              class="text-[10px] font-bold text-indigo-500 flex-shrink-0"
              >{formatCompactCurrency(p.revenue)}</span
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
