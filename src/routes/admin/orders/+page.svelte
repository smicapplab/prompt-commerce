<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';

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

  const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  const STATUS_COLORS: Record<string, string> = {
    pending:    'bg-amber-50 text-amber-700',
    confirmed:  'bg-blue-50 text-blue-700',
    processing: 'bg-indigo-50 text-indigo-700',
    shipped:    'bg-purple-50 text-purple-700',
    delivered:  'bg-emerald-50 text-emerald-700',
    cancelled:  'bg-red-50 text-red-700',
  };

  let orders = $state<Order[]>([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let page = $state(1);
  const limit = 20;
  let q = $state('');
  let filterStatus = $state('');

  // Detail drawer
  let selectedOrder = $state<(Order & { items: OrderItem[] }) | null>(null);
  let drawerLoading = $state(false);
  let updatingStatus = $state(false);

  const token = () => localStorage.getItem('pc_token') ?? '';

  async function load(sid = activeStore.slug) {
    if (!sid) return;
    loading = true;
    const params = new URLSearchParams({ store: sid, page: String(page), limit: String(limit), q, status: filterStatus });
    const res = await fetch(`/api/orders?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
    loading = false;
    if (res.ok) {
      const data = await res.json();
      orders = data.orders;
      totalCount = data.totalCount;
    }
  }

  async function openOrder(order: Order) {
    drawerLoading = true;
    selectedOrder = { ...order, items: [] };
    const res = await fetch(`/api/orders/${order.id}?store=${activeStore.slug}`, { headers: { Authorization: `Bearer ${token()}` } });
    drawerLoading = false;
    if (res.ok) selectedOrder = await res.json();
  }

  async function updateStatus(id: number, status: string) {
    updatingStatus = true;
    const res = await fetch(`/api/orders/${id}?store=${activeStore.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status })
    });
    updatingStatus = false;
    if (res.ok) {
      const updated = await res.json();
      orders = orders.map(o => o.id === id ? { ...o, status: updated.status } : o);
      if (selectedOrder?.id === id) selectedOrder = { ...selectedOrder, ...updated };
    }
  }

  async function search() { page = 1; await load(); }
  const totalPages = $derived(Math.ceil(totalCount / limit));

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatCurrency(n: number | null) {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
  }

  onMount(() => {
    if (activeStore.slug) { load(activeStore.slug); }
  });
</script>

<svelte:head><title>Orders — Prompt Commerce</title></svelte:head>

<div class="flex min-h-full">
  <!-- Main list -->
  <div class="flex-1 p-6 min-w-0 overflow-hidden">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold text-gray-900">Orders</h1>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-5">
      <input
        type="search"
        placeholder="Search buyer, notes…"
        bind:value={q}
        onkeydown={(e) => e.key === 'Enter' && search()}
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <select bind:value={filterStatus} onchange={search} class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option value="">All statuses</option>
        {#each STATUS_OPTIONS as s}
          <option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
        {/each}
      </select>
      <button onclick={search} class="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">Search</button>
    </div>

    <!-- Table -->
    <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th class="px-4 py-3">Order #</th>
            <th class="px-4 py-3">Buyer</th>
            <th class="px-4 py-3">Channel</th>
            <th class="px-4 py-3">Items</th>
            <th class="px-4 py-3">Total</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#if loading}
            <tr><td colspan="7" class="px-4 py-12 text-center text-gray-400">Loading…</td></tr>
          {:else if orders.length === 0}
            <tr><td colspan="7" class="px-4 py-12 text-center text-gray-400">
              {activeStore.slug ? 'No orders found.' : 'Select a store to see orders.'}
            </td></tr>
          {:else}
            {#each orders as order}
              <tr
                class="hover:bg-gray-50 cursor-pointer {selectedOrder?.id === order.id ? 'bg-indigo-50' : ''}"
                onclick={() => openOrder(order)}
              >
                <td class="px-4 py-3 font-mono text-xs text-gray-600">#{String(order.id).padStart(6, '0')}</td>
                <td class="px-4 py-3 text-gray-900">{order.buyer_ref ?? '—'}</td>
                <td class="px-4 py-3 capitalize text-gray-600">{order.channel}</td>
                <td class="px-4 py-3 text-gray-600">{order.item_count}</td>
                <td class="px-4 py-3 font-medium text-gray-900">{formatCurrency(order.total)}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}">
                    {order.status}
                  </span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500">{formatDate(order.created_at)}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>{totalCount} orders</span>
        <div class="flex gap-2">
          <button onclick={() => { page--; load(); }} disabled={page <= 1} class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Prev</button>
          <span class="px-3 py-1.5">Page {page} of {totalPages}</span>
          <button onclick={() => { page++; load(); }} disabled={page >= totalPages} class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Next</button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Detail Drawer -->
  {#if selectedOrder}
    <div class="w-96 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col sticky top-0 self-start h-screen overflow-y-auto">
      <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-gray-900">Order #{String(selectedOrder.id).padStart(6, '0')}</p>
          <p class="text-xs text-gray-500 mt-0.5">{formatDate(selectedOrder.created_at)}</p>
        </div>
        <button onclick={() => (selectedOrder = null)} class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      {#if drawerLoading}
        <div class="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      {:else}
        <div class="flex-1 p-5 space-y-5">
          <!-- Buyer info -->
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Buyer</p>
            <p class="text-sm text-gray-900">{selectedOrder.buyer_ref ?? 'Unknown'}</p>
            <p class="text-xs text-gray-500 capitalize mt-0.5">via {selectedOrder.channel}</p>
          </div>

          <!-- Status -->
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Status</p>
            <select
              value={selectedOrder.status}
              onchange={(e) => updateStatus(selectedOrder!.id, (e.target as HTMLSelectElement).value)}
              disabled={updatingStatus}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {#each STATUS_OPTIONS as s}
                <option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              {/each}
            </select>
          </div>

          <!-- Items -->
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Items</p>
            {#if selectedOrder.items?.length === 0}
              <p class="text-sm text-gray-400">No items recorded.</p>
            {:else}
              <div class="space-y-2">
                {#each selectedOrder.items as item}
                  <div class="flex items-start justify-between text-sm">
                    <div>
                      <p class="text-gray-900 font-medium">{item.title}</p>
                      <p class="text-gray-500 text-xs">×{item.quantity}</p>
                    </div>
                    <p class="text-gray-900 font-medium">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                {/each}
              </div>
              <div class="border-t border-gray-200 mt-3 pt-3 flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{formatCurrency(selectedOrder.total)}</span>
              </div>
            {/if}
          </div>

          <!-- Notes -->
          {#if selectedOrder.notes}
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Notes</p>
              <p class="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{selectedOrder.notes}</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
