<script lang="ts">
  import { Pencil, RefreshCw, Store, Truck, Link as LinkIcon, CreditCard, X } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import type { Order } from "$lib/types/orders.js";

  let { order, onSave } = $props<{ 
    order: Order, 
    onSave: (fields: Record<string, any>) => Promise<boolean> 
  }>();

  let editingDelivery = $state(false);
  let editDeliveryType = $state("");
  let editDeliveryAddress = $state("");
  let savingDelivery = $state(false);

  let editingPayment = $state(false);
  let editPaymentProvider = $state("");
  let savingPayment = $state(false);

  function startEditDelivery() {
    editDeliveryType = (order as any)?.delivery_type ?? "delivery";
    editDeliveryAddress = (order as any)?.delivery_address ?? "";
    editingDelivery = true;
  }

  async function saveDelivery() {
    savingDelivery = true;
    const ok = await onSave({ 
      delivery_type: editDeliveryType,
      delivery_address: editDeliveryAddress || null
    });
    savingDelivery = false;
    if (ok) editingDelivery = false;
  }

  function startEditPayment() {
    editPaymentProvider = (order as any)?.payment_provider ?? "cod";
    editingPayment = true;
  }

  async function savePayment() {
    savingPayment = true;
    const ok = await onSave({ payment_provider: editPaymentProvider });
    savingPayment = false;
    if (ok) editingPayment = false;
  }
</script>

<div class="space-y-6">
  <!-- Delivery Detail Box -->
  <Card class="p-6">
    <div class="flex items-center justify-between mb-4">
      <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Handover</p>
      {#if !editingDelivery}
        <Button onclick={startEditDelivery} variant="secondary" size="sm" class="p-1 h-auto border-none bg-transparent text-indigo-600">
          <Pencil size={12} />
        </Button>
      {/if}
    </div>

    {#if editingDelivery}
      <div class="space-y-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 animate-in slide-in-from-top-2">
        <Select
          id="delivery-type"
          bind:value={editDeliveryType}
          options={[
            { value: 'delivery', label: 'Home Delivery' },
            { value: 'pickup', label: 'Store Pickup' }
          ]}
        />
        <textarea
          id="delivery-address"
          bind:value={editDeliveryAddress}
          placeholder="Street, City, Province, ZIP Code..."
          rows="3"
          class="w-full rounded-2xl border border-gray-100 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all resize-none font-medium"
        ></textarea>
        <div class="flex gap-2">
          <Button onclick={() => (editingDelivery = false)} variant="secondary" size="sm" class="flex-1 bg-white">
            Cancel
          </Button>
          <Button onclick={saveDelivery} disabled={savingDelivery} variant="primary" size="sm" class="flex-1">
            {#if savingDelivery}
              <RefreshCw size={12} class="animate-spin" />
            {/if}
            Save
          </Button>
        </div>
      </div>
    {:else}
      <div class="space-y-2">
        <p class="text-sm font-black text-gray-900 flex items-center gap-1.5">
          {#if (order as any).delivery_type === "pickup"}
            <Store size={16} class="text-indigo-600" /> Store Pickup
          {:else}
            <Truck size={16} class="text-indigo-600" /> Home Delivery
          {/if}
        </p>
        {#if (order as any).delivery_address}
          <p class="text-[11px] text-gray-500 leading-relaxed font-bold italic">
            "{(order as any).delivery_address}"
          </p>
        {/if}
      </div>
    {/if}
  </Card>

  <!-- Tracking/Payment Section -->
  <Card class="p-6 space-y-6">
    <!-- Tracking -->
    {#if (order as any).tracking_number}
      <div class="p-4 bg-sky-50/50 rounded-2xl border border-sky-100 flex gap-3">
        <Truck size={20} class="text-sky-600 shrink-0" />
        <div>
          <p class="text-[10px] font-black text-sky-400 uppercase tracking-widest leading-none mb-1.5">Live Tracking Info</p>
          <p class="text-sm font-black text-sky-900 leading-none">
            {(order as any).courier_name || 'Carrier'}: {(order as any).tracking_number}
          </p>
          {#if (order as any).tracking_url}
            <a href={(order as any).tracking_url} target="_blank" class="inline-flex items-center gap-1.5 text-[10px] font-black text-sky-600 uppercase tracking-widest hover:underline mt-2">
              <LinkIcon size={12} />
              Trace Package
            </a>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Payment Method -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Provider</p>
        {#if !editingPayment}
          <Button onclick={startEditPayment} variant="secondary" size="sm" class="p-1 h-auto border-none bg-transparent text-indigo-600">
            <Pencil size={12} />
          </Button>
        {/if}
      </div>
      {#if editingPayment}
        <div class="space-y-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 animate-in slide-in-from-top-2">
          <Select
            bind:value={editPaymentProvider}
            options={[
              { value: 'cod', label: 'Cash on Delivery' },
              { value: 'mock', label: 'Mock / Test' },
              { value: 'assisted', label: 'Assisted / Manual' },
              { value: 'paymongo', label: 'PayMongo' },
              { value: 'stripe', label: 'Stripe' }
            ]}
          />
          <div class="flex gap-2">
            <Button onclick={() => (editingPayment = false)} variant="secondary" size="sm" class="flex-1 bg-white">
              Cancel
            </Button>
            <Button onclick={savePayment} disabled={savingPayment} variant="primary" size="sm" class="flex-1">
              {#if savingPayment}
                <RefreshCw size={12} class="animate-spin" />
              {/if}
              Update
            </Button>
          </div>
        </div>
      {:else}
        <div class="flex items-center gap-2">
          <CreditCard size={18} class="text-gray-300" />
          <p class="text-xs font-black text-gray-900 uppercase tracking-wide">
            {(order as any).payment_provider || "NONE"}
          </p>
        </div>
        {#if (order as any).payment_instructions}
          <p class="text-[10px] text-gray-500 mt-2 font-bold italic bg-gray-50 p-2 rounded-lg border border-gray-100">
             "{(order as any).payment_instructions}"
          </p>
        {/if}
      {/if}
    </div>

    {#if (order as any).cancellation_reason}
      <div class="mt-6 p-4 bg-red-50/50 rounded-2xl border border-red-100 gap-3 flex flex-col">
        <div class="flex items-center gap-2">
          <X size={16} class="text-red-500" />
          <p class="text-[10px] font-black text-red-400 uppercase tracking-widest text-center">Order was Cancelled</p>
        </div>
        <p class="text-xs font-bold text-red-900 leading-relaxed bg-white/50 p-3 rounded-xl">
          "{(order as any).cancellation_reason}"
        </p>
      </div>
    {/if}
  </Card>
</div>
