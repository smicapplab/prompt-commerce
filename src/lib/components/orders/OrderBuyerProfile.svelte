<script lang="ts">
  import { Pencil, RefreshCw } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { CHANNELS } from "$lib/constants/orders.js";
  import type { Order } from "$lib/types/orders.js";

  let { order, onSave } = $props<{ 
    order: Order, 
    onSave: (fields: Record<string, any>) => Promise<boolean> 
  }>();

  let editingBuyer = $state(false);
  let editBuyerRef = $state("");
  let editBuyerName = $state("");
  let editBuyerEmail = $state("");
  let editChannel = $state("");
  let savingBuyer = $state(false);

  function startEditBuyer() {
    editBuyerRef = order?.buyer_ref ?? "";
    editBuyerName = (order as any)?.buyer_name ?? "";
    editBuyerEmail = (order as any)?.buyer_email ?? "";
    editChannel = order?.channel ?? "manual";
    editingBuyer = true;
  }

  async function saveBuyer() {
    savingBuyer = true;
    const ok = await onSave({
      buyer_ref: editBuyerRef || null,
      buyer_name: editBuyerName || null,
      buyer_email: editBuyerEmail || null,
      channel: editChannel,
    });
    savingBuyer = false;
    if (ok) editingBuyer = false;
  }
</script>

<Card class="p-0 overflow-hidden">
  <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
    <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
      Buyer Profile
    </h2>
    {#if !editingBuyer}
      <Button onclick={startEditBuyer} variant="secondary" size="sm" class="h-8 border-none bg-transparent group">
        <Pencil size={14} class="mr-1.5 text-indigo-600" />
        Edit
      </Button>
    {/if}
  </div>
  <div class="p-6">
    {#if editingBuyer}
      <div class="space-y-6">
        <Input id="edit-buyer-name" label="Customer Name" bind:value={editBuyerName} placeholder="e.g. John Dela Cruz" />
        <Input id="edit-buyer-email" label="Email Address" type="email" bind:value={editBuyerEmail} placeholder="e.g. john@example.com" />
        <Input id="edit-buyer-ref" label="Platform Ref / ID" bind:value={editBuyerRef} placeholder="e.g. TG-123456" />
        <div class="space-y-1.5">
          <label for="edit-channel" class="text-[11px] font-black uppercase tracking-widest text-gray-400 px-1">Source Channel</label>
          <Select
            id="edit-channel"
            bind:value={editChannel}
            options={CHANNELS}
          />
        </div>
        <div class="flex gap-3 pt-2">
          <Button onclick={() => (editingBuyer = false)} variant="secondary" class="flex-1">
            Cancel
          </Button>
          <Button onclick={saveBuyer} disabled={savingBuyer} variant="primary" class="flex-1">
            {#if savingBuyer}
              <RefreshCw size={14} class="animate-spin" />
            {/if}
            Apply Changes
          </Button>
        </div>
      </div>
    {:else}
      <div class="flex items-center gap-4 mb-6">
        <div class="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100">
          {((order as any).buyer_name || order.buyer_ref || "G")[0].toUpperCase()}
        </div>
        <div class="min-w-0">
          <p class="font-black text-lg text-gray-900 truncate">
            {(order as any).buyer_name || "Guest Buyer"}
          </p>
          {#if (order as any).buyer_email}
            <p class="text-xs text-gray-400 font-bold mt-0.5 truncate uppercase tracking-tight">{ (order as any).buyer_email }</p>
          {/if}
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-2">
        <Badge class="bg-gray-100 text-gray-500 border-none font-bold text-[9px]">
          {order.channel.toUpperCase()}
        </Badge>
        {#if order.buyer_ref}
          <Badge class="bg-indigo-50 text-indigo-600 border-none font-bold text-[9px] font-mono">
            ID: {order.buyer_ref}
          </Badge>
        {/if}
      </div>
    {/if}
  </div>
</Card>
