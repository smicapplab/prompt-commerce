<script lang="ts">
  import { Package } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { formatCurrency } from "$lib/utils/format.js";
  import type { OrderItem } from "$lib/types/orders.js";

  let { items, total } = $props<{ items: OrderItem[], total: number | null }>();
</script>

<Card class="overflow-hidden p-0">
  <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
    <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
      Cart Items
    </h2>
    <Badge variant="secondary" class="font-bold border-none bg-indigo-50 text-indigo-600">
      {items?.length || 0} Items
    </Badge>
  </div>
  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <tbody class="divide-y divide-gray-100">
        {#each items as item}
          <tr class="group hover:bg-gray-50/50 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 shrink-0 overflow-hidden shadow-sm">
                  {#if item.product_images?.[0]}
                    <img src={item.product_images[0]} alt={item.title} class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  {:else}
                    <div class="w-full h-full flex items-center justify-center text-gray-300">
                      <Package size={20} class="opacity-30" />
                    </div>
                  {/if}
                </div>
                <div>
                  <p class="font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </p>
                  <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">
                     {formatCurrency(item.price)} per unit
                  </p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-center">
              <div class="flex flex-col items-center">
                <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Quantity</span>
                <span class="font-black text-lg text-gray-900">{item.quantity}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex flex-col items-end">
                <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Subtotal</span>
                <span class="font-black text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot class="bg-indigo-50/20">
        <tr class="border-t border-gray-100">
          <td colspan="2" class="px-6 py-6 text-right">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Grand Total Amount</span>
          </td>
          <td class="px-6 py-6 text-right">
            <span class="text-2xl font-black text-indigo-600 tracking-tight leading-none">
              {formatCurrency(total)}
            </span>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</Card>
