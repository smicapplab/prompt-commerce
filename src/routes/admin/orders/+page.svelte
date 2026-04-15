<script lang="ts">
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { goto } from "$app/navigation";
  import type { Order } from "$lib/types/orders.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import SyncBanner from "$lib/components/SyncBanner.svelte";
  import { Plus, Search, RefreshCw, ChevronLeft, ChevronRight, Package, User, CreditCard, Truck } from "@lucide/svelte";

  import { STATUS_OPTIONS, STATUS_COLORS } from "$lib/constants/orders.js";

  let orders = $state<Order[]>([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let page = $state(1);
  const limit = 20;
  let q = $state("");
  let filterStatus = $state("");
  
  // Sync Status
  let syncBanner = $state<any>();

  const token = () => localStorage.getItem("pc_token") ?? "";

  async function load(sid = activeStore.slug) {
    if (!sid) return;
    loading = true;
    const params = new URLSearchParams({
      store: sid,
      page: String(page),
      limit: String(limit),
      q,
      status: filterStatus,
    });
    const res = await fetch(`/api/orders?${params}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    loading = false;
    if (res.ok) {
      const data = await res.json();
      orders = data.orders;
      totalCount = data.totalCount;
    }
    syncBanner?.loadDirtyCount();
  }

  async function search() {
    page = 1;
    await load();
  }
  const totalPages = $derived(Math.ceil(totalCount / limit));

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatCurrency(n: number | null) {
    if (n == null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(n);
  }

  onMount(() => {
    // UX-R2-7: Validate status from URL
    const urlParams = new URLSearchParams(window.location.search);
    const s = urlParams.get("status");
    if (s && STATUS_OPTIONS.includes(s)) {
      filterStatus = s;
    }

    if (activeStore.slug) {
      load(activeStore.slug);
    }
  });
</script>

<svelte:head><title>Orders — Prompt Commerce</title></svelte:head>

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-black text-gray-900 tracking-tight">Orders</h1>
      <p class="text-sm text-gray-400 font-medium mt-1">
        Manage and track your store's customer orders.
      </p>
    </div>
    <Button
      onclick={() => goto("/admin/orders/new")}
      variant="primary"
    >
      <Plus size={18} />
      Create Manual Order
    </Button>
  </div>

  <SyncBanner bind:this={syncBanner} onSyncComplete={load} />


  <!-- Filters -->
  <Card class="p-4 mb-6">
    <div class="flex flex-col md:flex-row gap-4">
      <div class="flex-1 relative">
        <Search
          size={18}
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <Input
          type="search"
          placeholder="Search by buyer or notes..."
          bind:value={q}
          onkeydown={(e) => e.key === "Enter" && search()}
          class="pl-10"
        />
      </div>
      <div class="flex gap-4">
        <Select
          bind:value={filterStatus}
          onchange={search}
          class="w-48"
          options={[
            { value: '', label: 'All Statuses' },
            ...STATUS_OPTIONS.map(s => ({
              value: s,
              label: s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
            }))
          ]}
        />
        <Button
          onclick={search}
          variant="secondary"
          class="whitespace-nowrap"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  </Card>

  <!-- Table -->
  <Card class="overflow-hidden p-0">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50/80 border-b border-gray-100">
          <tr>
            <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Order ID</th>
            <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Buyer</th>
            <th class="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Channel</th>
            <th class="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Delivery</th>
            <th class="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Items</th>
            <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Total</th>
            <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
            <th class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#if loading}
            <tr>
              <td colspan="8" class="px-6 py-24 text-center">
                <div class="flex flex-col items-center gap-3">
                  <RefreshCw size={24} class="text-indigo-600 animate-spin" />
                  <p class="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Loading orders...</p>
                </div>
              </td>
            </tr>
          {:else if orders.length === 0}
            <tr>
              <td colspan="8" class="px-6 py-24 text-center">
                <div class="flex flex-col items-center justify-center max-w-sm mx-auto text-gray-400">
                  <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Package size={24} class="opacity-40" />
                  </div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">No orders found</h3>
                  <p class="text-sm">
                    {activeStore.slug
                      ? "No orders found matching your search or filters."
                      : "Please select a store to view orders."}
                  </p>
                  {#if activeStore.slug}
                    <Button
                      variant="primary"
                      onclick={() => goto("/admin/orders/new")}
                      class="mt-6"
                    >
                      Create Manual Order
                    </Button>
                  {/if}
                </div>
              </td>
            </tr>
          {:else}
            {#each orders as order}
              <tr
                class="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                onclick={() => (goto(`/admin/orders/${order.id}`))}
              >
                <td class="px-6 py-4">
                  <Badge variant="secondary" class="font-mono text-[10px] border-none text-indigo-600 bg-indigo-50/50">
                    #{String(order.id).padStart(6, "0")}
                  </Badge>
                </td>
                <td class="px-6 py-4">
                  <div class="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {order.buyer_ref ?? "Guest Buyer"}
                  </div>
                  {#if order.notes}
                    <div class="text-[10px] text-gray-400 font-medium mt-0.5 max-w-[180px] truncate italic">
                      "{order.notes}"
                    </div>
                  {/if}
                </td>
                <td class="px-6 py-4 text-center">
                  <Badge class="bg-gray-100 text-gray-500 border-none font-bold text-[9px]">
                    {order.channel}
                  </Badge>
                </td>
                <td class="px-6 py-4 text-center">
                  <Badge class="border-none font-bold text-[9px] {order.delivery_type === 'pickup' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}">
                    {order.delivery_type || 'delivery'}
                  </Badge>
                </td>
                <td class="px-6 py-4 text-center font-black text-gray-900">
                  {order.item_count}
                </td>
                <td class="px-6 py-4 font-black text-gray-900 leading-tight">
                  {formatCurrency(order.total)}
                </td>
                <td class="px-6 py-4">
                  <Badge variant="secondary" class="font-bold {STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}">
                    {order.status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                  </Badge>
                </td>
                <td class="px-6 py-4">
                  <div class="text-[10px] font-bold text-gray-900 leading-tight">
                    {formatDate(order.created_at).split(" at ")[0]}
                  </div>
                  <div class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                    {formatDate(order.created_at).split(" at ")[1] || ""}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div
        class="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between"
      >
        <div class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
          Page {page} of {totalPages} ({totalCount} orders)
        </div>
        <div class="flex items-center gap-1">
          <Button
            onclick={() => { page--; load(); }}
            disabled={page <= 1}
            variant="secondary"
            size="sm"
            class="p-2 h-auto border-none"
          >
            <ChevronLeft size={20} />
          </Button>
          <div
            class="px-3 py-1 rounded-lg bg-white border border-gray-100 text-[10px] font-black text-gray-700"
          >
            {page} / {totalPages}
          </div>
          <Button
            onclick={() => { page++; load(); }}
            disabled={page >= totalPages}
            variant="secondary"
            size="sm"
            class="p-2 h-auto border-none"
          >
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>
    {/if}
  </Card>
</div>
