<script lang="ts">
  import { MapPin, Link as LinkIcon, RefreshCw } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import type { Order } from "$lib/types/orders.js";

  let { order, googlePlacesApiKey, onSave } = $props<{ 
    order: Order, 
    googlePlacesApiKey: string,
    onSave: (fields: Record<string, any>) => Promise<boolean> 
  }>();

  let editingLocation = $state(false);
  let editLat = $state("");
  let editLng = $state("");
  let savingLocation = $state(false);

  function startEditLocation() {
    editLat = order?.lat?.toString() ?? "";
    editLng = order?.lng?.toString() ?? "";
    editingLocation = true;
  }

  async function saveLocation() {
    savingLocation = true;
    const ok = await onSave({ 
      lat: editLat ? parseFloat(editLat) : null,
      lng: editLng ? parseFloat(editLng) : null 
    });
    savingLocation = false;
    if (ok) editingLocation = false;
  }
</script>

<Card class="p-0 overflow-hidden text-center justify-items-center">
  <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between focus:outline-none">
    <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
      Geospatial Pin
    </h2>
    {#if !editingLocation}
      <Button onclick={startEditLocation} variant="secondary" size="sm" class="h-8 border-none bg-transparent group">
        <MapPin size={14} class="mr-1.5 text-indigo-600" />
        {order.lat && order.lng ? 'Remap' : 'Add Map'}
      </Button>
    {/if}
  </div>
  <div class="p-6">
    {#if editingLocation}
      <div class="space-y-6">
        <div class="grid grid-cols-2 gap-4">
          <Input id="edit-lat" label="Latitude" type="number" bind:value={editLat} placeholder="e.g. 14.5995" />
          <Input id="edit-lng" label="Longitude" type="number" bind:value={editLng} placeholder="e.g. 120.9842" />
        </div>
        <div class="flex gap-3">
          <Button onclick={() => (editingLocation = false)} variant="secondary" class="flex-1">
            Cancel
          </Button>
          <Button onclick={saveLocation} disabled={savingLocation} variant="primary" class="flex-1">
            {#if savingLocation}
              <RefreshCw size={14} class="animate-spin mr-1.5" />
            {/if}
            Save Pin
          </Button>
        </div>
      </div>
    {:else if order.lat && order.lng}
      <div class="space-y-6">
        <div class="aspect-video w-full rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 relative group shadow-sm">
          <iframe
            title="Order Location"
            width="100%"
            height="100%"
            frameborder="0"
            style="border:0"
            src="https://www.google.com/maps/embed/v1/place?key={googlePlacesApiKey}&q={order.lat},{order.lng}&zoom=15"
            allowfullscreen
            class="group-hover:opacity-90 transition-opacity"
          ></iframe>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="px-3 py-1.5 bg-gray-100 rounded-lg">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">GPS Coordinates</span>
            <code class="text-[11px] font-mono font-bold text-gray-700">{order.lat.toFixed(6)}, {order.lng.toFixed(6)}</code>
          </div>
          <Button
            variant="secondary"
            onclick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${order?.lat},${order?.lng}`, '_blank')}
            class="font-black text-[10px] tracking-widest uppercase border-gray-200"
          >
            Open Google Maps
            <LinkIcon size={14} class="ml-2" />
          </Button>
        </div>
      </div>
    {:else}
      <div class="py-12 flex flex-col items-center justify-center text-center">
        <div class="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-200 mb-6 group">
           <MapPin size={28} class="group-hover:text-indigo-600 transition-colors" />
        </div>
        <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight mb-2">No GPS Pin Added</h3>
        <p class="text-xs font-medium text-gray-400 mb-6 max-w-50">Coordinates help delivery riders find the customer faster.</p>
        <Button onclick={startEditLocation} variant="primary" size="sm" class="px-8 border-none bg-indigo-600 font-black">
          Set Coords
        </Button>
      </div>
    {/if}
  </div>
</Card>
