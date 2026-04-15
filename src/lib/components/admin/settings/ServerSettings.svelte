<script lang="ts">
  import {
    Server,
    Globe,
    Link2,
    Check,
    RefreshCw,
    Info,
    ExternalLink,
    Lock,
    Shield,
    AlertCircle,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import { fade } from "svelte/transition";

  // Internal state
  let serverSettings = $state<Record<string, string>>({});
  let userRole = $state("");
  let loading = $state(false);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state("");

  const token = () => localStorage.getItem("pc_token") ?? "";

  onMount(load);

  async function load() {
    loading = true;
    error = "";
    try {
      // Get current user role first
      const meRes = await fetch('/api/users/profile', {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (meRes.ok) {
        const me = await meRes.json();
        userRole = me.role;
      }

      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        serverSettings = await res.json();
      }
    } catch (e) {
      error = "Load failed";
    } finally {
      loading = false;
    }
  }

  function setServer(key: string, value: string) {
    serverSettings[key] = value;
  }

  async function saveServer() {
    saving = true;
    saved = false;
    error = "";
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(serverSettings),
      });

      if (res.ok) {
        serverSettings = await res.json();
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

{#if loading && !serverSettings.gateway_url}
  <div class="flex items-center justify-center py-20">
    <RefreshCw size={32} class="animate-spin text-gray-300" />
  </div>
{:else}
  <div class="space-y-8 animate-in fade-in duration-500 pb-20">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 tracking-tight">System Infrastructure</h2>
      <p class="text-sm text-gray-500 mt-1">Configure core connectivity between the seller panel and the AI gateway.</p>
    </div>

    {#if error}
      <div class="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700 shadow-sm">
        <AlertCircle size={18} />
        <p class="text-sm font-bold">{error}</p>
      </div>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Gateway Connectivity Card -->
      <Card class="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
        <div class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Globe size={20} />
          </div>
          <div>
            <h3 class="font-bold text-gray-900 leading-none">Gateway Endpoint</h3>
            <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">Central Controller</p>
          </div>
        </div>

        <div class="p-6 space-y-4 flex-1">
          <Input
            id="g-url"
            label="Gateway URL"
            disabled={userRole !== "super_admin"}
            value={serverSettings.gateway_url}
            oninput={(e: Event) => setServer("gateway_url", (e.target as HTMLInputElement).value)}
            placeholder="http://localhost:3002"
            description="Must match the base URL of your NestJS gateway instance."
            class="font-mono"
          >
            {#snippet left()}
              <Link2 size={14} />
            {/snippet}
          </Input>

          {#if userRole !== "super_admin"}
            <div class="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
              <Lock size={16} class="text-amber-600 shrink-0 mt-0.5" />
              <p class="text-[10px] text-amber-700 font-medium leading-relaxed">
                Infrastructure settings are restricted to Super Administrators. Contact your system admin to change the gateway endpoint.
              </p>
            </div>
          {/if}
        </div>
      </Card>

      <!-- Public Access Card -->
      <Card class="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
        <div class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
            <ExternalLink size={20} />
          </div>
          <div>
            <h3 class="font-bold text-gray-900 leading-none">Public Presence</h3>
            <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">Customer Facing</p>
          </div>
        </div>

        <div class="p-6 space-y-4 flex-1">
          <Input
            id="p-url"
            label="Seller Public URL"
            disabled={userRole !== "super_admin"}
            value={serverSettings.seller_public_url}
            oninput={(e: Event) => setServer("seller_public_url", (e.target as HTMLInputElement).value)}
            placeholder="https://admin.yourstore.com"
            description="Required for canonical image URLs and customer callbacks."
            class="font-mono"
          />

          <div class="mt-auto p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-start gap-3">
            <Shield size={16} class="text-blue-600 shrink-0 mt-0.5" />
            <p class="text-[10px] text-blue-700 font-medium leading-relaxed italic">
              Ensure your SSL certificates are valid for this domain to avoid mixed-content issues in Telegram or WhatsApp.
            </p>
          </div>
        </div>
      </Card>

      <!-- External Services Card -->
      <Card class="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
        <div class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 class="font-bold text-gray-900 leading-none">Global Google Cloud</h3>
            <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">System Defaults</p>
          </div>
        </div>

        <div class="p-6 space-y-4 flex-1">
          <Input
            id="g-places-key"
            label="Default Address Picker Key"
            disabled={userRole !== "super_admin"}
            value={serverSettings.google_places_browser_key || serverSettings.google_places_api_key || ""}
            oninput={(e: Event) => setServer("google_places_browser_key", (e.target as HTMLInputElement).value)}
            placeholder="AIzaSy... (Client-side)"
            class="font-mono"
          />

          <Input
            id="g-maps-key"
            label="Default Order Map Key"
            disabled={userRole !== "super_admin"}
            value={serverSettings.google_maps_embed_key || serverSettings.google_places_api_key || ""}
            oninput={(e: Event) => setServer("google_maps_embed_key", (e.target as HTMLInputElement).value)}
            placeholder="AIzaSy... (Staff-only)"
            class="font-mono"
          />

          <div class="p-4 rounded-2xl bg-orange-50/50 border border-orange-100">
            <p class="text-[10px] text-orange-800 font-medium leading-relaxed italic">
              These keys serve as global fallbacks. Individual sellers can override these in their own <strong>Maintenance</strong> tab using domain-restricted keys.
            </p>
          </div>
        </div>
      </Card>
    </div>

    <!-- Actions -->
    {#if userRole === "super_admin"}
      <div class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-6 -mx-6 flex items-center justify-between z-20">
        <Button
          onclick={saveServer}
          disabled={saving}
          variant="primary"
          class="px-10 py-3.5 bg-gray-900 border-none hover:bg-black shadow-gray-100"
        >
          {#if saving}
            <RefreshCw size={18} class="animate-spin mr-2" /> Persisting Config
          {:else if saved}
            <Check size={18} class="mr-2" /> Config Synchronized
          {:else}
            Update System Protocol
          {/if}
        </Button>

        <div class="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          <span class="flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-green-500"></div> DB: SQLite/Registry</span>
          <span class="flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Environment: Auto-Detected</span>
        </div>
      </div>
    {/if}
  </div>
{/if}
