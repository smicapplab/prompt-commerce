<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { Store, Plus, ArrowRight } from "@lucide/svelte";

  interface StoreItem {
    id: number;
    slug: string;
    name: string;
    description: string | null;
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
    activeStore.set(s.slug, s.id, s.name);
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

<svelte:head><title>Select Store — Prompt Commerce</title></svelte:head>

<div class="min-h-full flex flex-col items-center justify-center p-8">
  <div class="w-full max-w-lg">
    <div class="text-center mb-8">
      <div
        class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4"
      >
        <Store class="w-6 h-6 text-white" />
      </div>
      <h1 class="text-2xl font-semibold text-gray-900">Select a store</h1>
      <p class="text-sm text-gray-500 mt-1">
        Choose which store you want to manage
      </p>
    </div>

    {#if loading}
      <div class="space-y-3">
        {#each Array(2) as _}
          <div class="h-20 rounded-xl bg-gray-100 animate-pulse"></div>
        {/each}
      </div>
    {:else if stores.length === 0}
      <div
        class="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl"
      >
        <Store class="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p class="text-sm font-medium text-gray-600">No stores connected yet</p>
        <p class="text-xs text-gray-400 mt-1">
          Register a store via the gateway, then connect it here.
        </p>
        <a
          href="/admin/stores"
          class="inline-flex items-center gap-2 mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus class="w-4 h-4" /> Connect a store
        </a>
      </div>
    {:else}
      <div class="space-y-3">
        {#each stores.filter((s) => s.active) as s}
          <button
            onclick={() => enter(s)}
            class="w-full flex items-center justify-between gap-4 bg-white border border-gray-200 hover:border-blue-400 hover:shadow-sm rounded-xl px-5 py-4 text-left transition-all group"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0"
              >
                <Store class="w-5 h-5 text-blue-600" />
              </div>
              <div class="min-w-0">
                <p class="font-medium text-gray-900 text-sm">{s.name}</p>
                <p class="text-xs text-gray-400 font-mono mt-0.5">{s.slug}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              {#if !s.gateway_key}
                <span
                  class="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"
                  >No key</span
                >
              {/if}
              <ArrowRight
                class="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors"
              />
            </div>
          </button>
        {/each}

        {#each stores.filter((s) => !s.active) as s}
          <div
            class="w-full flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 opacity-50"
          >
            <div
              class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"
            >
              <Store class="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p class="font-medium text-gray-600 text-sm">{s.name}</p>
              <p class="text-xs text-gray-400 font-mono mt-0.5">
                {s.slug} · Inactive
              </p>
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-6 text-center">
        <a
          href="/admin/stores"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Manage stores →
        </a>
      </div>
    {/if}
  </div>
</div>
