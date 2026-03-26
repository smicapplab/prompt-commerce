<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';
  import { goto } from '$app/navigation';

  interface Product {
    id: number;
    title: string;
    price: number;
    sku: string;
    stock_quantity: number;
  }

  interface OrderItem {
    product_id: number | null;
    title: string;
    price: number;
    quantity: number;
  }

  let buyer_ref = $state('');
  let notes = $state('');
  let channel = $state('manual');
  let items = $state<OrderItem[]>([]);
  let products = $state<Product[]>([]);
  let productSearch = $state('');
  let loadingProducts = $state(false);
  let submitting = $state(false);
  let error = $state('');

  const filteredProducts = $derived(
    productSearch.trim()
      ? products.filter(p =>
          p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
        )
      : products
  );

  const token = () => localStorage.getItem('pc_token') ?? '';

  async function loadProducts() {
    loadingProducts = true;
    const res = await fetch(`/api/products?store=${activeStore.slug}&limit=100`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    loadingProducts = false;
    if (res.ok) {
      const data = await res.json();
      products = data.products;
    }
  }

  function addItem(p: Product) {
    const existing = items.find(i => i.product_id === p.id);
    if (existing) {
      existing.quantity++;
    } else {
      items.push({
        product_id: p.id,
        title: p.title,
        price: p.price,
        quantity: 1
      });
    }
  }

  function removeItem(index: number) {
    items.splice(index, 1);
  }

  async function submit() {
    if (!buyer_ref) return error = 'Buyer name is required';
    if (items.length === 0) return error = 'Add at least one item';
    
    submitting = true;
    error = '';
    
    const res = await fetch(`/api/orders?store=${activeStore.slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({
        buyer_ref,
        notes,
        channel,
        items
      })
    });
    
    submitting = false;
    if (res.ok) {
      const data = await res.json();
      goto(`/admin/orders/${data.id}`);
    } else {
      const data = await res.json();
      error = data.error || 'Failed to create order';
    }
  }

  onMount(() => {
    if (activeStore.slug) loadProducts();
  });

  const total = $derived(items.reduce((acc, i) => acc + (i.price * i.quantity), 0));

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
  }
</script>

<svelte:head><title>Create Order — Prompt Commerce</title></svelte:head>

<div class="p-6 max-w-6xl mx-auto pb-24">
  <div class="flex items-center gap-4 mb-8">
    <button 
      onclick={() => goto('/admin/orders')} 
      class="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500"
      aria-label="Go back to orders list"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
    </button>
    <h1 class="text-2xl font-bold text-gray-900">Create Manual Order</h1>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <!-- Left: Form -->
    <div class="lg:col-span-2 space-y-6">
      
      <!-- Buyer Details -->
      <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 class="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Buyer Information</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="buyer_ref" class="block text-xs font-bold text-gray-500 uppercase mb-1">Buyer Name / Ref</label>
            <input 
              id="buyer_ref"
              bind:value={buyer_ref}
              placeholder="e.g. John Doe"
              class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
            />
          </div>
          <div>
            <label for="channel" class="block text-xs font-bold text-gray-500 uppercase mb-1">Source Channel</label>
            <select 
              id="channel"
              bind:value={channel}
              class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
            >
              <option value="manual">Manual Entry</option>
              <option value="facebook">Facebook Messenger</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="viber">Viber</option>
            </select>
          </div>
        </div>
        <div class="mt-4">
          <label for="notes" class="block text-xs font-bold text-gray-500 uppercase mb-1">Internal Notes</label>
          <textarea 
            id="notes"
            bind:value={notes}
            placeholder="Shipping instructions, preferred delivery time, etc."
            rows="2"
            class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
          ></textarea>
        </div>
      </div>

      <!-- Items -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 class="text-sm font-bold text-gray-900 uppercase tracking-wider">Order Items</h2>
        </div>
        {#if items.length === 0}
          <div class="p-12 text-center">
            <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            </div>
            <p class="text-gray-400 font-medium italic">No items added to this order yet.</p>
          </div>
        {:else}
          <table class="w-full text-left text-sm">
            <tbody class="divide-y divide-gray-100">
              {#each items as item, i}
                <tr class="group">
                  <td class="px-6 py-4">
                    <p class="font-bold text-gray-900">{item.title}</p>
                    <p class="text-xs text-gray-400 mt-0.5">{formatCurrency(item.price)} each</p>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                       <input 
                        type="number" 
                        bind:value={item.quantity} 
                        min="1"
                        class="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                       />
                    </div>
                  </td>
                  <td class="px-6 py-4 text-right font-bold text-gray-900">
                    {formatCurrency(item.price * item.quantity)}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <button 
                      onclick={() => removeItem(i)}
                      class="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      aria-label="Remove item"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="bg-gray-50/50">
                <td colspan="2" class="px-6 py-4 text-sm font-bold text-gray-500 text-right uppercase tracking-wider">Total Amount</td>
                <td class="px-6 py-4 text-right text-lg font-black text-indigo-600">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        {/if}
      </div>
    </div>

    <!-- Right: Product Selector -->
    <div class="space-y-6">
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[600px]">
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 class="text-sm font-bold text-gray-900 uppercase tracking-wider">Add Products</h2>
        </div>
        <div class="p-4 border-b border-gray-100">
          <input
            type="search"
            bind:value={productSearch}
            placeholder="Search products..."
            class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
          />
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-2">
          {#if loadingProducts}
            <div class="py-12 flex flex-col items-center gap-2 text-gray-400">
              <div class="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              <p class="text-xs">Loading products…</p>
            </div>
          {:else if filteredProducts.length === 0}
            <div class="py-12 text-center text-gray-400 text-sm">
              {productSearch ? 'No products match your search.' : 'No products available.'}
            </div>
          {:else}
            {#each filteredProducts as p}
              {@const outOfStock = p.stock_quantity <= 0}
              <button
                onclick={() => !outOfStock && addItem(p)}
                disabled={outOfStock}
                class="w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center group active:scale-[0.98]
                  {outOfStock
                    ? 'border-gray-100 opacity-50 cursor-not-allowed bg-gray-50'
                    : 'border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30'}"
              >
                <div>
                  <p class="text-sm font-bold text-gray-900 {outOfStock ? '' : 'group-hover:text-indigo-700'}">{p.title}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    {#if p.sku}<span class="text-xs font-mono text-gray-400">{p.sku}</span>{/if}
                    <span class="text-xs font-bold text-emerald-600">{formatCurrency(p.price)}</span>
                    <span class="text-[10px] font-bold {outOfStock ? 'text-red-400' : 'text-gray-400'}">
                      {outOfStock ? 'Out of stock' : `${p.stock_quantity} left`}
                    </span>
                  </div>
                </div>
                {#if !outOfStock}
                  <div class="p-1.5 rounded-lg bg-gray-50 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  </div>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
      </div>

      {#if error}
        <div class="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
          {error}
        </div>
      {/if}

      <button 
        onclick={submit}
        disabled={submitting || items.length === 0}
        class="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
      >
        {#if submitting}
          <div class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
          Creating Order...
        {:else}
          Finalize Order
        {/if}
      </button>
    </div>

  </div>
</div>
