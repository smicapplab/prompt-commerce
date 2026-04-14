<script lang="ts">
  import {
    Shield,
    Key,
    RefreshCw,
    Check,
    Eye,
    EyeOff,
    Info,
    AlertCircle,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import { fade } from "svelte/transition";

  // Internal state
  let data = $state<Record<string, string | boolean>>({});
  let loading = $state(false);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state("");

  // Input states for keys (masked by server)
  let googlePlacesBrowserKeyInput = $state("");
  let googleMapsEmbedKeyInput = $state("");

  // Visibility toggles
  let showPlaces = $state(false);
  let showMaps = $state(false);

  const token = () => localStorage.getItem("pc_token") ?? "";

  function val(key: string, fallback = ""): string {
    return String(data[key] ?? fallback);
  }

  $effect(() => {
    if (activeStore.slug) load();
  });

  async function load() {
    if (!activeStore.slug) return;
    loading = true;
    error = "";
    try {
      const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      error = "Load failed";
    } finally {
      loading = false;
    }
  }

  async function saveMaintenance() {
    if (!activeStore.slug) return;
    saving = true;
    saved = false;
    error = "";
    
    const payload: Record<string, string | null> = {};
    if (googlePlacesBrowserKeyInput) payload.google_places_browser_key = googlePlacesBrowserKeyInput.trim();
    if (googleMapsEmbedKeyInput) payload.google_maps_embed_key = googleMapsEmbedKeyInput.trim();

    if (Object.keys(payload).length === 0) {
      saving = false;
      return;
    }

    try {
      const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        data = await res.json();
        googlePlacesBrowserKeyInput = googleMapsEmbedKeyInput = "";
        saved = true;
        setTimeout(() => (saved = false), 3000);
      } else {
        const d = await res.json();
        error = d.error ?? "Save failed";
      }
    } catch (e) {
      error = "Connection error";
    } finally {
      saving = false;
    }
  }
</script>

{#if !activeStore.slug}
  <div class="flex flex-col items-center justify-center py-12 text-center text-gray-400">
    <Shield size={48} strokeWidth={1} />
    <p class="mt-4 text-sm font-medium">Select a store from the sidebar first.</p>
  </div>
{:else if loading && !data.google_places_browser_key_set && data.google_places_browser_key_set !== false}
  <div class="flex items-center justify-center py-20">
    <RefreshCw size={32} class="animate-spin text-gray-300" />
  </div>
{:else}
  <div class="space-y-8 animate-in fade-in duration-500 pb-20">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-black text-gray-900 tracking-tight">Maintenance & Infrastructure</h2>
      <p class="text-sm text-gray-500 mt-1">Configure external service integrations and API keys specific to <strong>{activeStore.name}</strong>.</p>
    </div>

    {#if error}
      <div class="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700 shadow-sm">
        <AlertCircle size={18} />
        <p class="text-sm font-bold">{error}</p>
      </div>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Google Cloud Card -->
      <Card class="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
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
          <div class="relative">
            <Input
              id="places-key"
              label="Address Picker Key"
              type={showPlaces ? "text" : "password"}
              bind:value={googlePlacesBrowserKeyInput}
              placeholder={data.google_places_browser_key_set ? "••••••••••••••••" : "AIzaSy... (Client-side)"}
              description="Used by the Buyer to find delivery addresses. Needs Places API enabled."
              class="font-mono"
            >
              {#snippet labelExtra()}
                {#if data.google_places_browser_key_set}
                  <Badge class="bg-green-50 text-green-600 border-none px-1.5 py-0.5 ml-1">Configured</Badge>
                {/if}
              {/snippet}
              <button 
                type="button"
                onclick={() => showPlaces = !showPlaces}
                class="absolute right-4 top-[34px] -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                slot="right"
              >
                {#if showPlaces}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
              </button>
            </Input>
          </div>

          <!-- Maps Key -->
          <div class="relative">
            <Input
              id="maps-key"
              label="Order Map Key"
              type={showMaps ? "text" : "password"}
              bind:value={googleMapsEmbedKeyInput}
              placeholder={data.google_maps_embed_key_set ? "••••••••••••••••" : "AIzaSy... (Staff-only)"}
              description="Used in the Admin Panel to show order pins. Needs Maps Embed API enabled."
              class="font-mono"
            >
              {#snippet labelExtra()}
                {#if data.google_maps_embed_key_set}
                  <Badge class="bg-green-50 text-green-600 border-none px-1.5 py-0.5 ml-1">Configured</Badge>
                {/if}
              {/snippet}
              <button 
                type="button"
                onclick={() => showMaps = !showMaps}
                class="absolute right-4 top-[34px] -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                slot="right"
              >
                {#if showMaps}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
              </button>
            </Input>
          </div>
        </div>
      </Card>

      <!-- Security & Restrictions Card -->
      <Card class="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
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
      </Card>
    </div>

    <!-- Actions -->
    <div class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-6 -mx-6 flex items-center justify-between z-20">
      <Button
        onclick={saveMaintenance}
        disabled={saving}
        variant="primary"
        class="px-10 py-3.5 bg-gray-900 border-none hover:bg-black shadow-gray-100"
      >
        {#if saving}
          <RefreshCw size={18} class="animate-spin mr-2" /> Updating Infrastructure
        {:else if saved}
          <Check size={18} class="mr-2" /> Protocol Synchronized
        {:else}
          Save Infrastructure Config
        {/if}
      </Button>

      <div class="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
        <span class="flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-green-500"></div> DB: SQLite/Store</span>
        <span class="flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Push: WebSocket/REST</span>
      </div>
    </div>
  </div>
{/if}
