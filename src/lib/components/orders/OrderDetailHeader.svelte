<script lang="ts">
  import { goto } from "$app/navigation";
  import { ChevronLeft, RefreshCw, Truck, Store, ArrowRight } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { STATUS_COLORS } from "$lib/constants/orders.js";
  import { formatDate } from "$lib/utils/format.js";
  import type { Order } from "$lib/types/orders.js";

  let { 
    order, 
    updating, 
    nextStep, 
    onUpdateStatus 
  } = $props<{ 
    order: Order, 
    updating: boolean, 
    nextStep: any, 
    onUpdateStatus: (status: string) => void 
  }>();

  const id = $derived(order.id);
</script>

<div class="flex flex-col md:flex-row md:items-center gap-6 mb-10">
  <div class="flex items-center gap-4">
    <Button
      onclick={() => goto("/admin/orders")}
      variant="secondary"
      size="sm"
      class="rounded-full w-10 h-10 p-0 border-none bg-gray-100 hover:bg-gray-200"
    >
      <ChevronLeft size={20} />
    </Button>
    <div>
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-3xl font-black text-gray-900 tracking-tight">
          Order #{String(id).padStart(6, "0")}
        </h1>
        <Badge variant="secondary" class="font-bold {STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}">
          {order.status.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
        </Badge>
        <Badge class="border-none font-bold text-[10px] gap-1.5 {(order as any).delivery_type === 'pickup' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}">
          {#if (order as any).delivery_type === "pickup"}
            <Store size={10} /> Store Pickup
          {:else}
            <Truck size={10} /> Home Delivery
          {/if}
        </Badge>
      </div>
      <p class="text-sm text-gray-400 font-medium mt-1">
        Placed on {formatDate(order.created_at)} via {order.channel}
      </p>
    </div>
  </div>

  <div class="md:ml-auto flex items-center gap-3">
    {#if order.status !== "cancelled" && order.status !== "delivered" && order.status !== "picked_up" && order.status !== "refunded"}
      <Button
        onclick={() => onUpdateStatus("cancelled")}
        variant="secondary"
        class="text-red-500 hover:text-red-700 hover:bg-red-50 border-none"
      >
        Cancel Order
      </Button>
    {/if}
    {#if nextStep}
      <Button
        onclick={() => onUpdateStatus(nextStep.id)}
        disabled={updating}
        variant="primary"
        size="lg"
        class="min-w-45"
      >
        {#if updating}
          <RefreshCw size={18} class="animate-spin mr-2" />
        {/if}
        Mark as {nextStep.label}
        <ArrowRight size={18} class="ml-1" />
      </Button>
    {/if}
  </div>
</div>
