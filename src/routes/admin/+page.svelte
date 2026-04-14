<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { 
    Store, 
    Plus, 
    ArrowRight, 
    ChevronRight, 
    ShieldAlert, 
    RefreshCw,
    Building2,
    LayoutDashboard
  } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";

  interface StoreItem {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    gateway_key: string | null;
    active: number;
  }

  let stores = $state<StoreItem[]>([]);
  let loading = $state(true);

  function token() {
    return localStorage.getItem("pc_token") ?? "";
  }

  async function load() {
    loading = true;
    const res = await fetch("/api/stores", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    stores = res.ok ? await res.json() : [];
    loading = false;
  }

  function enter(s: StoreItem) {
    activeStore.set(s.slug, s.id, s.name, s.logo_url || "");
    goto("/admin/dashboard");
  }

  onMount(async () => {
    await load();
    // Auto-enter if only one store exists — but NOT when the user clicked "Switch"
    const isSwitching = new URLSearchParams(window.location.search).has(
      "switch",
    );
    if (stores.length === 1 && !isSwitching) enter(stores[0]);
  });
</script>

<svelte:head>
  <title>Retailer Access — Prompt Commerce</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
  <!-- Aesthetic Decorations -->
  <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
    <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full"></div>
    <div class="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full"></div>
  </div>

  <div class="w-full max-w-xl relative z-10">
    <!-- Header -->
    <div class="text-center mb-12">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-600 shadow-xl shadow-indigo-100 mb-6 transition-transform hover:scale-110 duration-500">
        <LayoutDashboard size={32} class="text-white" />
      </div>
      <h1 class="text-4xl font-black text-gray-900 tracking-tight mb-2">Select a Store</h1>
      <p class="text-sm font-medium text-gray-400 uppercase tracking-widest">Identify your retail workspace to continue</p>
    </div>

    {#if loading}
      <div class="space-y-4">
        {#each Array(3) as _}
          <div class="h-24 rounded-3xl bg-white border border-gray-100 animate-pulse"></div>
        {/each}
      </div>
    {:else if stores.length === 0}
      <Card class="p-10 text-center flex flex-col items-center">
        <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-8">
          <Store size={40} />
        </div>
        <h2 class="text-xl font-black text-gray-900 mb-2">Registry Empty</h2>
        <p class="text-sm font-medium text-gray-400 max-w-xs mb-10 leading-relaxed">
          There are no connected retailers available for this account. Register a store via the gateway first.
        </p>
        <Button 
          variant="primary" 
          onclick={() => goto('/admin/stores')}
          class="w-full h-14 rounded-2xl bg-gray-900 border-none hover:bg-black font-black uppercase text-xs tracking-widest"
        >
          <Plus size={18} class="mr-2" /> Connect New Store
        </Button>
      </Card>
    {:else}
      <div class="space-y-4">
        {#each stores.filter((s) => s.active) as s}
          <button
            onclick={() => enter(s)}
            class="w-full text-left group transition-all"
          >
            <Card class="p-6 flex items-center justify-between group-hover:border-indigo-600 group-hover:shadow-2xl group-hover:shadow-indigo-50 group-hover:-translate-y-1 duration-300 border-gray-100">
              <div class="flex items-center gap-5 min-w-0">
                <div class="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm overflow-hidden">
                  {#if s.logo_url}
                    <img src={s.logo_url} alt={s.name} class="w-full h-full object-cover" />
                  {:else}
                    <Building2 size={24} />
                  {/if}
                </div>
                <div class="min-w-0">
                  <h3 class="font-black text-gray-900 text-lg leading-tight mb-1 group-hover:text-indigo-600 transition-colors">{s.name}</h3>
                  <div class="flex items-center gap-3">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono truncate">{s.slug}</span>
                    {#if !s.gateway_key}
                      <Badge variant="secondary" class="bg-amber-50 text-amber-600 border-none font-bold text-[9px] uppercase tracking-tighter">
                        <ShieldAlert size={10} class="mr-1" /> No Gateway Key
                      </Badge>
                    {/if}
                  </div>
                </div>
              </div>
              <div class="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                <ChevronRight size={20} />
              </div>
            </Card>
          </button>
        {/each}

        {#each stores.filter((s) => !s.active) as s}
          <div class="w-full opacity-50 grayscale cursor-not-allowed">
            <Card class="p-6 flex items-center gap-5 border-gray-100 bg-gray-50/50">
              <div class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
                <Store size={24} />
              </div>
              <div>
                <h3 class="font-black text-gray-600 text-lg leading-tight mb-1">{s.name}</h3>
                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inactive Registry</span>
              </div>
            </Card>
          </div>
        {/each}
      </div>

      <div class="mt-12 text-center">
        <Button 
          variant="secondary" 
          onclick={() => goto('/admin/stores')}
          class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-none bg-transparent hover:bg-white hover:text-gray-900 shadow-none px-6"
        >
          Manage External Registrations <ArrowRight size={14} class="ml-2" />
        </Button>
      </div>
    {/if}
    
    <!-- Identity Footer -->
    <div class="mt-20 pt-8 border-t border-gray-100 text-center">
      <p class="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Prompt Commerce Administration Module</p>
    </div>
  </div>
</div>
