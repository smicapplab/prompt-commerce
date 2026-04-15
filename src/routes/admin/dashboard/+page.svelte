<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { ShoppingCart } from "@lucide/svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import type { Stats } from "$lib/types/dashboard.js";
  import type { StoreSettings } from "$lib/types/settings.js";

  // New Components
  import SetupChecklist from "$lib/components/dashboard/SetupChecklist.svelte";
  import StatCardsGrid from "$lib/components/dashboard/StatCardsGrid.svelte";
  import RevenueChart from "$lib/components/dashboard/RevenueChart.svelte";
  import StatusBreakdown from "$lib/components/dashboard/StatusBreakdown.svelte";
  import RecentOrdersMini from "$lib/components/dashboard/RecentOrdersMini.svelte";
  import TopProductsMini from "$lib/components/dashboard/TopProductsMini.svelte";
  import CatalogQuickLinks from "$lib/components/dashboard/CatalogQuickLinks.svelte";

  let stats = $state<Stats | null>(null);
  let loading = $state(true);
  let error = $state("");

  let storeSettings = $state<StoreSettings | null>(null);
  let setupLoading = $state(true);

  const token = () => localStorage.getItem("pc_token") ?? "";

  onMount(async () => {
    if (!browser) return;
    if (!activeStore.id) {
      goto("/admin");
      return;
    }
    loading = true;
    const res = await fetch(`/api/stores/${activeStore.id}/stats`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) stats = await res.json();
    else error = "Could not load dashboard data.";
    loading = false;

    // Load store settings for checklist
    setupLoading = true;
    try {
      const sres = await fetch(`/api/settings?store=${activeStore.slug}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (sres.ok) storeSettings = await sres.json();
    } catch (e) {
      console.error("Failed to load setup status", e);
    }
    setupLoading = false;
  });
</script>

<svelte:head>
  <title>Dashboard — {activeStore.name || "Store"}</title>
</svelte:head>

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto space-y-8">
  <!-- Page header -->
  <div class="flex items-start justify-between">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-black text-gray-900 tracking-tight">
        {activeStore.name || activeStore.slug}
      </h1>
      <Badge
        class="bg-gray-100 text-gray-600 border-gray-200 font-mono tracking-normal"
        >{activeStore.slug}</Badge
      >
    </div>
    <Button href="/admin/orders/new" variant="primary">
      <ShoppingCart class="w-4 h-4" />
      New Order
    </Button>
  </div>

  {#if loading}
    <!-- Skeleton -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {#each Array(4) as _}
        <Card class="p-5 animate-pulse h-28" />
      {/each}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card class="lg:col-span-2 animate-pulse h-52" />
      <Card class="animate-pulse h-52" />
    </div>
  {:else if error}
    <div
      class="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 font-medium"
    >
      {error}
    </div>
  {:else if stats}
    <!-- Setup Checklist -->
    {#if !setupLoading && storeSettings}
      <SetupChecklist {storeSettings} {stats} />
    {/if}

    <!-- KPI Row -->
    <StatCardsGrid {stats} />

    <!-- Middle row: Chart + Status breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <RevenueChart {stats} />
      <StatusBreakdown {stats} />
    </div>

    <!-- Bottom row: Recent orders + Top products -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <RecentOrdersMini recentOrders={stats.recentOrders} />
      <TopProductsMini topProducts={stats.topProducts} />
    </div>

    <!-- Catalog quick-links -->
    <CatalogQuickLinks {stats} />
  {/if}
</div>
