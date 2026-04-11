<script lang="ts">
  import {
    Shield,
    Key,
    ExternalLink,
    RefreshCw,
    Check,
    Eye,
    EyeOff,
    Info,
    AlertCircle,
    Server,
    Settings
  } from "@lucide/svelte";

  let { 
    activeStore, 
    storeSettings, 
    val, 
    set, 
    saving, 
    saved, 
    googlePlacesBrowserKeyInput = $bindable(),
    googleMapsEmbedKeyInput = $bindable(),
    showGooglePlacesKey = $bindable(),
    showGoogleMapsKey = $bindable(),
    onSave
  } = $props();

  let localPlacesKey = $state("");
  let localMapsKey = $state("");
  let showPlaces = $state(false);
  let showMaps = $state(false);

  // Initialize from parent if provided, otherwise keep empty
  $effect(() => {
    // These are masking-aware
  });
</script>

<div class="space-y-8 animate-in fade-in duration-500 pb-20">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-black text-gray-900 tracking-tight">Maintenance & Infrastructure</h2>
    <p class="text-sm text-gray-500 mt-1">Configure external service integrations and API keys specific to <strong>{activeStore.name}</strong>.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Google Cloud Card -->
    <div class="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h3 class="font-bold text-gray-900 leading-none">Google Cloud</h3>
          <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">Places & Maps</p>
        </div>
      </div>

      <div class="p-6 space-y-6">
        <!-- Places Key -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between px-1">
            <label for="places-key" class="text-[11px] font-black uppercase tracking-widest text-gray-400">Address Picker Key</label>
            {#if storeSettings.google_places_browser_key_set}
              <span class="text-[9px] font-black text-green-500 uppercase tracking-tighter bg-green-50 px-1.5 py-0.5 rounded">Configured</span>
            {/if}
          </div>
          <div class="relative group">
            <Key size={14} class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="places-key"
              type={showPlaces ? "text" : "password"}
              bind:value={googlePlacesBrowserKeyInput}
              placeholder={storeSettings.google_places_browser_key_set ? "••••••••••••••••" : "AIzaSy... (Client-side)"}
              class="w-full rounded-2xl border border-gray-100 bg-gray-50/30 pl-10 pr-12 py-3 text-sm font-mono focus:bg-white focus:border-orange-500 outline-none transition-all"
            />
            <button 
              type="button"
              onclick={() => showPlaces = !showPlaces}
              class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {#if showPlaces}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
            </button>
          </div>
          <p class="text-[10px] text-gray-400 leading-tight">Used by the <strong>Buyer</strong> to find delivery addresses. Needs Places API enabled.</p>
        </div>

        <!-- Maps Key -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between px-1">
            <label for="maps-key" class="text-[11px] font-black uppercase tracking-widest text-gray-400">Order Map Key</label>
            {#if storeSettings.google_maps_embed_key_set}
              <span class="text-[9px] font-black text-green-500 uppercase tracking-tighter bg-green-50 px-1.5 py-0.5 rounded">Configured</span>
            {/if}
          </div>
          <div class="relative group">
            <Key size={14} class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="maps-key"
              type={showMaps ? "text" : "password"}
              bind:value={googleMapsEmbedKeyInput}
              placeholder={storeSettings.google_maps_embed_key_set ? "••••••••••••••••" : "AIzaSy... (Staff-only)"}
              class="w-full rounded-2xl border border-gray-100 bg-gray-50/30 pl-10 pr-12 py-3 text-sm font-mono focus:bg-white focus:border-orange-500 outline-none transition-all"
            />
            <button 
              type="button"
              onclick={() => showMaps = !showMaps}
              class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {#if showMaps}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
            </button>
          </div>
          <p class="text-[10px] text-gray-400 leading-tight">Used in the <strong>Admin Panel</strong> to show order pins. Needs Maps Embed API enabled.</p>
        </div>
      </div>
    </div>

    <!-- Security & Restrictions Card -->
    <div class="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
          <Shield size={20} />
        </div>
        <div>
          <h3 class="font-bold text-gray-900 leading-none">Restriction Rules</h3>
          <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">Security Policy</p>
        </div>
      </div>

      <div class="p-6 space-y-4">
        <div class="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
          <div class="flex items-center gap-2">
            <Info size={14} class="text-indigo-600" />
            <p class="text-[11px] font-bold text-indigo-900 uppercase">Best Practices</p>
          </div>
          <ul class="text-[11px] text-indigo-800 space-y-2 list-disc pl-4 font-medium leading-relaxed">
            <li>Use <strong>HTTP Referrer</strong> restrictions in Google Cloud Console.</li>
            <li>Restict the <strong>Address Picker Key</strong> to your gateway domain.</li>
            <li>Restrict the <strong>Order Map Key</strong> to your admin domain.</li>
            <li>Enable only the required APIs for each key to limit exposure.</li>
          </ul>
        </div>

        <div class="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
          <AlertCircle size={16} class="text-amber-600 shrink-0 mt-0.5" />
          <p class="text-[10px] text-amber-800 font-medium leading-relaxed italic">
            Leaving these keys empty will cause the system to fall back to the global server-wide defaults configured by the system administrator.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-6 -mx-6 flex items-center justify-between z-10">
    <button
      onclick={onSave}
      disabled={saving}
      class="inline-flex items-center gap-3 rounded-2xl bg-gray-900 px-10 py-3.5 text-sm font-black text-white hover:bg-black active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-gray-100"
    >
      {#if saving}
        <RefreshCw size={18} class="animate-spin" /> Updating Infrastructure
      {:else if saved === "maintenance"}
        <Check size={18} /> Protocol Synchronized
      {:else}
        Save Infrastructure Config
      {/if}
    </button>

    <div class="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
      <span class="flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-green-500"></div> DB: SQLite/Store</span>
      <span class="flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Push: WebSocket/REST</span>
    </div>
  </div>
</div>
