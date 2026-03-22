<script lang="ts">
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { goto } from "$app/navigation";

  interface OrderItem {
    id: number;
    product_id: number | null;
    title: string;
    price: number;
    quantity: number;
    product_title: string | null;
  }

  interface Order {
    id: number;
    store: number;
    buyer_ref: string | null;
    channel: string;
    status: string;
    total: number | null;
    notes: string | null;
    item_count: number;
    created_at: string;
    updated_at: string;
  }

  const STATUS_OPTIONS = [
    "pending",
    "paid",
    "picking",
    "packing",
    "ready_for_pickup",
    "in_transit",
    "delivered",
    "cancelled",
    "refunded",
  ];

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    paid: "bg-blue-100 text-blue-700 border-blue-200",
    picking: "bg-indigo-100 text-indigo-700 border-indigo-200",
    packing: "bg-violet-100 text-violet-700 border-violet-200",
    ready_for_pickup: "bg-cyan-100 text-cyan-700 border-cyan-200",
    in_transit: "bg-sky-100 text-sky-700 border-sky-200",
    delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    refunded: "bg-gray-100 text-gray-700 border-gray-200",
  };

  let orders = $state<Order[]>([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let page = $state(1);
  const limit = 20;
  let q = $state("");
  let filterStatus = $state("");

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
  }

  async function search() {
    page = 1;
    await load();
  }
  const totalPages = $derived(Math.ceil(totalCount / limit));

  function formatDate(d: string) {
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
    if (activeStore.slug) {
      load(activeStore.slug);
    }
  });
</script>

<svelte:head><title>Orders — Prompt Commerce</title></svelte:head>

<div class="p-6 max-w-7xl mx-auto">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Orders</h1>
      <p class="text-sm text-gray-500 mt-1">
        Manage and track your store's customer orders.
      </p>
    </div>
    <button
      onclick={() => goto("/admin/orders/new")}
      class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all active:scale-95"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        /></svg
      >
      Create Manual Order
    </button>
  </div>

  <!-- Filters -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <div class="md:col-span-2 relative">
      <div
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
      >
        <svg
          class="h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          /></svg
        >
      </div>
      <input
        type="search"
        placeholder="Search by buyer or notes..."
        bind:value={q}
        onkeydown={(e) => e.key === "Enter" && search()}
        class="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none"
      />
    </div>

    <select
      bind:value={filterStatus}
      onchange={search}
      class="block w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none"
    >
      <option value="">All Statuses</option>
      {#each STATUS_OPTIONS as s}
        <option value={s}
          >{s
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")}</option
        >
      {/each}
    </select>

    <button
      onclick={search}
      class="rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
    >
      Apply Filters
    </button>
  </div>

  <!-- Table -->
  <div
    class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
  >
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm border-collapse">
        <thead>
          <tr class="bg-gray-50/50 border-b border-gray-100">
            <th class="px-6 py-4 font-semibold text-gray-600">Order ID</th>
            <th class="px-6 py-4 font-semibold text-gray-600">Buyer</th>
            <th class="px-6 py-4 font-semibold text-gray-600 text-center"
              >Channel</th
            >
            <th class="px-6 py-4 font-semibold text-gray-600 text-center"
              >Items</th
            >
            <th class="px-6 py-4 font-semibold text-gray-600">Total</th>
            <th class="px-6 py-4 font-semibold text-gray-600">Status</th>
            <th class="px-6 py-4 font-semibold text-gray-600">Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#if loading}
            <tr>
              <td colspan="7" class="px-6 py-24 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div
                    class="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"
                  ></div>
                  <p class="text-gray-400 font-medium">Loading orders...</p>
                </div>
              </td>
            </tr>
          {:else if orders.length === 0}
            <tr>
              <td colspan="7" class="px-6 py-24 text-center">
                <div class="flex flex-col items-center gap-4">
                  <div
                    class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300"
                  >
                    <svg
                      class="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      /></svg
                    >
                  </div>
                  <p class="text-gray-500 font-medium">
                    {activeStore.slug
                      ? "No orders found matching your criteria."
                      : "Please select a store to view orders."}
                  </p>
                </div>
              </td>
            </tr>
          {:else}
            {#each orders as order}
              <tr
                class="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                onclick={() =>
                  (window.location.href = `/admin/orders/${order.id}`)}
              >
                <td class="px-6 py-4">
                  <span
                    class="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded truncate"
                  >
                    #{String(order.id).padStart(6, "0")}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="font-medium text-gray-900">
                    {order.buyer_ref ?? "Guest Buyer"}
                  </div>
                  {#if order.notes}
                    <div
                      class="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate"
                    >
                      {order.notes}
                    </div>
                  {/if}
                </td>
                <td class="px-6 py-4 text-center">
                  <span
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-600"
                  >
                    {order.channel}
                  </span>
                </td>
                <td class="px-6 py-4 text-center text-gray-600 font-medium"
                  >{order.item_count}</td
                >
                <td class="px-6 py-4 font-bold text-gray-900"
                  >{formatCurrency(order.total)}</td
                >
                <td class="px-6 py-4">
                  <span
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border {STATUS_COLORS[
                      order.status
                    ] ?? 'bg-gray-100 text-gray-600 border-gray-200'}"
                  >
                    {order.status
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="text-xs font-medium text-gray-700">
                    {formatDate(order.created_at).split(" at ")[0]}
                  </div>
                  <div
                    class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-tighter"
                  >
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
        <p class="text-sm text-gray-500 font-medium">
          Showing <span class="text-gray-900">{orders.length}</span> of
          <span class="text-gray-900">{totalCount}</span> orders
        </p>
        <div class="flex items-center gap-1">
          <button
            onclick={() => {
              page--;
              load();
            }}
            disabled={page <= 1}
            class="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            aria-label="Previous page"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              /></svg
            >
          </button>
          <div
            class="px-4 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-bold text-gray-700"
          >
            {page} <span class="text-gray-300 mx-1">/</span>
            {totalPages}
          </div>
          <button
            onclick={() => {
              page++;
              load();
            }}
            disabled={page >= totalPages}
            class="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            aria-label="Next page"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              /></svg
            >
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
