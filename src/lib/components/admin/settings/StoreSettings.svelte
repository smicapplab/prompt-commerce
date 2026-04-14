<script lang="ts">
  import {
    Check,
    Store,
    Coins,
    Globe,
    Truck,
    RefreshCw,
    Building2,
    CalendarDays,
    Navigation,
    Info,
    ArrowUpRight,
    Image as ImageIcon,
    Upload,
    AlertCircle,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import { fade } from "svelte/transition";

  let { serverSettings } = $props<{ serverSettings: Record<string, string> }>();

  // Internal state
  let data = $state<Record<string, string>>({});
  let loading = $state(false);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state("");
  
  let uploadingLogo = $state(false);
  let logoError = $state("");

  const token = () => localStorage.getItem("pc_token") ?? "";

  // Helper for safe value access
  function val(key: string, fallback = ""): string {
    return String(data[key] ?? fallback);
  }

  // Load store settings whenever activeStore changes
  $effect(() => {
    if (activeStore.slug) {
      load();
    }
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
      } else {
        error = "Failed to load store settings";
      }
    } catch (e) {
      error = "Connection error while loading settings";
    } finally {
      loading = false;
    }
  }

  async function save() {
    if (!activeStore.slug) return;
    saving = true;
    saved = false;
    error = "";
    
    try {
      const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token()}` 
        },
        body: JSON.stringify({
          store_display_name: val("store_display_name"),
          store_currency: val("store_currency"),
          store_timezone: val("store_timezone"),
          allows_pickup: val("allows_pickup", "0"),
        }),
      });

      if (res.ok) {
        data = await res.json();
        saved = true;
        setTimeout(() => (saved = false), 3000);
      } else {
        const d = await res.json();
        error = d.error ?? "Save failed";
      }
    } catch (e) {
      error = "Connection error while saving";
    } finally {
      saving = false;
    }
  }

  async function handleLogoUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length || !activeStore.id) return;
    
    uploadingLogo = true;
    logoError = "";
    
    const formData = new FormData();
    formData.append('logo', input.files[0]);
    
    try {
      const res = await fetch(`/api/stores/${activeStore.id}/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token()}`
        },
        body: formData
      });
      
      if (res.ok) {
        const result = await res.json();
        activeStore.update({ logo_url: result.logo_url });
      } else {
        const result = await res.json();
        logoError = result.error || "Upload failed";
      }
    } catch (err) {
      logoError = "Connection error";
    } finally {
      uploadingLogo = false;
      input.value = ""; // reset
    }
  }
</script>

{#if !activeStore.slug}
  <div class="flex flex-col items-center justify-center py-20 text-center text-gray-400">
    <Store size={48} strokeWidth={1} />
    <p class="mt-4 text-sm font-medium">Select a store from the sidebar first.</p>
  </div>
{:else if loading && !data.store_display_name}
  <div class="flex items-center justify-center py-20">
    <RefreshCw size={32} class="animate-spin text-gray-300" />
  </div>
{:else}
  <div class="space-y-10 animate-in fade-in duration-700">
    <!-- Header with Public Link and Logo -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="flex items-center gap-6">
        <!-- Logo Upload Section -->
        <div class="relative group">
          <div class="w-24 h-24 rounded-3xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group-hover:border-indigo-300 transition-all shadow-sm">
            {#if activeStore.logo_url}
              <img src={activeStore.logo_url} alt="Store Logo" class="w-full h-full object-cover" />
            {:else}
              <ImageIcon class="text-gray-300" size={32} />
            {/if}
            
            {#if uploadingLogo}
              <div class="absolute inset-0 bg-white/80 flex items-center justify-center">
                <RefreshCw size={24} class="animate-spin text-indigo-600" />
              </div>
            {/if}
            
            <label class="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white">
              <Upload size={20} />
              <span class="text-[10px] font-bold mt-1 uppercase tracking-tighter text-center px-2">Update Logo</span>
              <input type="file" accept="image/*" class="hidden" onchange={handleLogoUpload} disabled={uploadingLogo} />
            </label>
          </div>
          {#if logoError}
            <div transition:fade class="absolute top-full left-0 w-48 text-[10px] text-red-500 font-bold mt-1 leading-tight flex items-center gap-1">
              <AlertCircle size={10} /> {logoError}
            </div>
          {/if}
        </div>

        <div>
          <div class="flex items-center gap-2 text-indigo-600 mb-1">
            <Building2 size={16} />
            <span class="text-[11px] font-black uppercase tracking-widest">Retailer Information</span>
          </div>
          <h2 class="text-3xl font-black text-gray-900 tracking-tight">
            {activeStore.name}
          </h2>
          <div class="flex items-center gap-3 mt-1">
            <span class="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 uppercase tracking-tighter">SLUG: {activeStore.slug}</span>
            {#if serverSettings.gateway_url}
              <a
                href="{serverSettings.gateway_url.replace(/\/$/, '')}/stores/{activeStore.slug}"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 decoration-2 underline-offset-4 hover:underline"
              >
                Visit Public Storefront <ArrowUpRight size={12} />
              </a>
            {/if}
          </div>
        </div>
      </div>
    </div>

    {#if error}
      <div class="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700">
        <AlertCircle size={18} />
        <p class="text-sm font-bold">{error}</p>
      </div>
    {/if}

    <!-- Main Settings Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Display Name Card -->
      <Card class="p-6 flex flex-col gap-4 group hover:shadow-md transition-all">
        <div class="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
          <Navigation size={20} />
        </div>
        <div>
          <Input
            id="s-name"
            label="Display Name"
            value={val("store_display_name")}
            oninput={(e: Event) => data.store_display_name = (e.target as HTMLInputElement).value}
            placeholder="Official Store Name"
          />
          <p class="mt-2 text-[11px] text-gray-500 leading-tight">Shown to buyers in messages and receipts.</p>
        </div>
      </Card>

      <!-- Currency Card -->
      <Card class="p-6 flex flex-col gap-4 group hover:shadow-md transition-all">
        <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <Coins size={20} />
        </div>
        <div>
          <Input
            id="s-currency"
            label="Currency"
            value={val("store_currency", "PHP")}
            oninput={(e: Event) => data.store_currency = (e.target as HTMLInputElement).value}
            placeholder="PHP"
            class="uppercase"
          />
          <p class="mt-2 text-[11px] text-gray-500 leading-tight">ISO 4217 code (PHP, USD, etc.)</p>
        </div>
      </Card>

      <!-- Timezone Card -->
      <Card class="p-6 flex flex-col gap-4 group hover:shadow-md transition-all">
        <div class="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
          <CalendarDays size={20} />
        </div>
        <div>
          <Input
            id="s-tz"
            label="Timezone"
            value={val("store_timezone", "Asia/Manila")}
            oninput={(e: Event) => data.store_timezone = (e.target as HTMLInputElement).value}
            placeholder="Asia/Manila"
          />
          <p class="mt-2 text-[11px] text-gray-500 leading-tight">Used for order timestamps.</p>
        </div>
      </Card>
    </div>

    <!-- Fulfillment Section -->
    <div class="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm relative overflow-hidden">
      <div class="relative z-10">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Truck size={24} />
          </div>
          <div>
            <h3 class="text-xl font-bold text-gray-900 leading-none">Fulfillment Options</h3>
            <p class="text-gray-500 text-sm mt-1">Configure how customers receive their orders.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div class="space-y-4">
            <Toggle
              checked={val("allows_pickup", "0") === "1"}
              onchange={(e) => data.allows_pickup = (e.target as HTMLInputElement).checked ? "1" : "0"}
              label="Store Pickup"
              description="Let buyers collect orders directly from your physical location."
            />
          </div>

          <div class="p-6 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
            <Info size={18} class="text-indigo-600 shrink-0 mt-0.5" />
            <p class="text-xs text-indigo-900/80 leading-relaxed italic">
              Note: Delivery fees and zones are configured separately in the <b>Shipping Matrix</b> (Coming soon). Standard delivery is enabled by default.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Fixed Bottom Actions -->
    <div class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-6 -mx-6 flex items-center justify-between z-20">
      <Button
        size="lg"
        variant="primary"
        onclick={save}
        disabled={saving}
        class="px-10 py-3.5 bg-gray-900 border-none hover:bg-black shadow-xl shadow-gray-200"
      >
        {#if saving}
          <RefreshCw size={20} class="animate-spin mr-2" /> Saving Changes
        {:else if saved}
          <Check size={20} class="text-green-400 mr-2" /> Changes Saved
        {:else}
          Commit Store Settings
        {/if}
      </Button>

      {#if saved}
        <div transition:fade class="flex items-center gap-2 px-4 py-2 border border-green-100 bg-green-50 rounded-xl text-green-700">
          <Check size={16} />
          <span class="text-xs font-black uppercase tracking-tight">System Updated Successfully</span>
        </div>
      {/if}
    </div>
  </div>
{/if}
