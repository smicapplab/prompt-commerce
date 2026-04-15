<script lang="ts">
  import { STATUS_STEPS } from "$lib/constants/orders.js";
  import { CircleCheck, Clock, X } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import type { OrderStatus } from "$lib/types/orders.js";

  let { status } = $props<{ status: OrderStatus }>();

  const currentStepIndex = $derived(
    STATUS_STEPS.findIndex((s) => s.id === status),
  );
</script>

<Card class="p-8">
  <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-10">
    Order Lifecycle
  </h2>
  <div class="relative">
    <div class="absolute top-5 left-0 w-full h-0.5 bg-gray-100">
      <div
        class="h-full bg-indigo-600 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(79,70,229,0.4)]"
        style="width: {currentStepIndex >= 0 ? (currentStepIndex / (STATUS_STEPS.length - 1)) * 100 : 0}%"
      ></div>
    </div>
    <div class="relative flex justify-between">
      {#each STATUS_STEPS as step, i}
        <div class="flex flex-col items-center">
          <div
            class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 z-10
            {i <= currentStepIndex
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
              : 'bg-white border-gray-100 text-gray-300'}"
          >
            {#if i < currentStepIndex}
              <CircleCheck size={18} />
            {:else if i === currentStepIndex}
              <Clock size={18} class="animate-pulse" />
            {:else}
              <div class="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
            {/if}
          </div>
          <p class="mt-4 text-[9px] font-black uppercase tracking-widest {i <= currentStepIndex ? 'text-indigo-600' : 'text-gray-400'}">
            {step.label}
          </p>
        </div>
      {/each}
    </div>
  </div>
  <!-- Cancelled/Refunded alert -->
  {#if status === "cancelled" || status === "refunded"}
    <div class="mt-10 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
      <X size={18} class="text-red-500" />
      <div class="text-[10px] font-black uppercase tracking-widest text-red-600">
        Order is {status}
      </div>
    </div>
  {/if}
</Card>
