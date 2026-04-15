<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';
  import { goto } from '$app/navigation';
  import type { Product, OrderItem } from '$lib/types/orders.js';
  
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  
  import { 
    ChevronLeft, 
    Plus, 
    Trash2, 
    Search, 
    Package, 
    User, 
    ShoppingCart,
    RefreshCw,
    X,
    Info,
    Store,
    Check
  } from '@lucide/svelte';

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
        price: p.price ?? 0,
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

<svelte:head>
  <title>Create Order — {activeStore.name || 'Prompt Commerce'}</title>
</svelte:head>

<div class="px-6 pt-6 pb-24 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex items-center gap-6 mb-10">
    <Button 
      variant="secondary" 
      size="sm" 
      onclick={() => goto('/admin/orders')}
      class="h-10 w-10 p-0 rounded-2xl shadow-none border-gray-100"
    >
      <ChevronLeft size={20} />
    </Button>
    <div>
      <h1 class="text-3xl font-black text-gray-900 tracking-tight leading-none mb-1">Manual Order</h1>
      <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Draft new transaction for {activeStore.name}</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
    
    <!-- Left Column: Order Composition (8 cols) -->
    <div class="lg:col-span-8 space-y-10">
      
      <!-- Buyer Profile Section -->
      <Card class="p-8">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <User size={20} />
          </div>
          <h2 class="text-sm font-black text-gray-900 uppercase tracking-widest">Customer Details</h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label for="buyer_ref" class="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Buyer Reference</label>
            <Input 
              id="buyer_ref"
              bind:value={buyer_ref}
              placeholder="e.g. John Doe (Messenger @john_d)"
              class="w-full"
            />
          </div>
          <div>
            <label for="channel" class="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Acquisition Channel</label>
            <Select 
              id="channel"
              bind:value={channel}
              options={[
                { value: "manual", label: "Manual Entry / Walk-in" },
                { value: "facebook", label: "Facebook Messenger" },
                { value: "instagram", label: "Instagram" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "viber", label: "Viber" },
                { value: "telegram", label: "Telegram" }
              ]}
            />
          </div>
        </div>
        <div class="mt-8">
          <label for="notes" class="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Operational Notes</label>
          <textarea 
            id="notes"
            bind:value={notes}
            placeholder="Special delivery instructions, preferred schedule, or internal references..."
            rows="3"
            class="w-full rounded-2xl border border-gray-100 bg-gray-50/30 p-4 text-sm focus:bg-white focus:border-indigo-200 outline-none transition-all resize-none leading-relaxed font-medium"
          ></textarea>
        </div>
      </Card>

      <!-- Cart Inventory Section -->
      <Card class="p-0 overflow-hidden">
        <div class="px-8 py-6 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShoppingCart size={20} />
            </div>
            <h2 class="text-sm font-black text-gray-900 uppercase tracking-widest">Order Cart</h2>
          </div>
          <Badge variant="secondary" class="bg-indigo-50 text-indigo-700 border-none font-bold">
            {items.length} items
          </Badge>
        </div>

        <div class="min-h-50">
          {#if items.length === 0}
            <div class="py-24 text-center">
              <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                <Package size={32} />
              </div>
              <p class="text-sm font-medium text-gray-400 max-w-xs mx-auto">
                No products have been added to this order. Select items from the catalog on the right.
              </p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="bg-white">
                    <th class="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product Details</th>
                    <th class="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Quantity</th>
                    <th class="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
                    <th class="px-8 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  {#each items as item, i}
                    <tr class="group hover:bg-gray-50/30 transition-colors">
                      <td class="px-8 py-6">
                        <p class="text-sm font-black text-gray-900 leading-tight mb-1">{item.title}</p>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{formatCurrency(item.price)} per unit</p>
                      </td>
                      <td class="px-8 py-6">
                        <div class="flex items-center justify-center">
                          <input 
                            type="number" 
                            bind:value={item.quantity} 
                            min="1"
                            class="w-20 rounded-xl border border-gray-100 bg-gray-50 px-2 py-2 text-center text-sm font-black text-gray-900 outline-none focus:bg-white focus:border-indigo-200 transition-all shadow-sm"
                          />
                        </div>
                      </td>
                      <td class="px-8 py-6 text-right font-black text-gray-900 tabular-nums">
                        {formatCurrency(item.price * item.quantity)}
                      </td>
                      <td class="px-8 py-6 text-right">
                        <button 
                          onclick={() => removeItem(i)}
                          class="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        {#if items.length > 0}
          <div class="bg-gray-50 border-t border-gray-100 px-8 py-6 flex justify-between items-center">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Grand Total</span>
            <span class="text-2xl font-black text-indigo-600 tabular-nums">{formatCurrency(total)}</span>
          </div>
        {/if}
      </Card>
    </div>

    <!-- Right Column: Catalog Browser (4 cols) -->
    <div class="lg:col-span-4 flex flex-col gap-6">
      <Card class="flex flex-col h-175 p-0 overflow-hidden sticky top-6">
        <div class="px-6 py-6 border-b border-gray-100 bg-white">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400">
              <Store size={20} />
            </div>
            <h2 class="text-sm font-black text-gray-900 uppercase tracking-widest">Store Catalog</h2>
          </div>
          
          <Input
            type="search"
            bind:value={productSearch}
            placeholder="Filter catalog..."
            class="bg-gray-50/50 border-none rounded-xl"
          >
            {#snippet icon()}
              <Search size={18} class="text-gray-400" />
            {/snippet}
          </Input>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {#if loadingProducts}
            <div class="py-24 text-center">
              <RefreshCw size={24} class="animate-spin text-indigo-600 mx-auto mb-4" />
              <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse">Syncing Products...</p>
            </div>
          {:else if filteredProducts.length === 0}
            <div class="py-24 text-center px-4">
              <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                <Search size={32} />
              </div>
              <h3 class="text-base font-black text-gray-900 uppercase tracking-tight mb-2">Catalog Empty</h3>
              <p class="text-xs font-medium text-gray-400 leading-relaxed">
                {productSearch ? 'No items match your current filter criteria.' : 'This store has no products available in its registry.'}
              </p>
            </div>
          {:else}
            {#each filteredProducts as p}
              {@const stock = (p.variant_count && p.variant_count > 0) ? p.total_stock : p.stock_quantity}
              {@const outOfStock = (stock ?? 0) <= 0}
              <button
                onclick={() => !outOfStock && addItem(p)}
                disabled={outOfStock}
                class="w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center group
                  {outOfStock
                    ? 'border-gray-50 opacity-40 grayscale cursor-not-allowed bg-gray-50/30'
                    : 'border-gray-50 bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/50 hover:-translate-y-0.5'}"
              >
                <div class="min-w-0 pr-4">
                  <p class="text-sm font-black text-gray-900 truncate mb-1 group-hover:text-indigo-600 transition-colors">{p.title}</p>
                  <div class="flex items-center gap-3">
                    <span class="text-[10px] font-black text-indigo-600 whitespace-nowrap">{formatCurrency(p.price ?? 0)}</span>
                    <span class="w-1 h-1 rounded-full bg-gray-200"></span>
                    <span class="text-[9px] font-black uppercase tracking-tight {outOfStock ? 'text-red-500' : 'text-gray-400'}">
                      {outOfStock ? 'Out of Stock' : `${stock ?? 0} In Stock`}
                    </span>
                  </div>
                  {#if p.sku}
                    <p class="text-[9px] font-mono text-gray-300 uppercase mt-1 tracking-tighter">SKU: {p.sku}</p>
                  {/if}
                </div>
                
                <div class="shrink-0">
                  {#if outOfStock}
                    <X size={16} class="text-gray-300" />
                  {:else}
                    <div class="w-8 h-8 rounded-xl bg-gray-50 group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center justify-center shadow-sm">
                      <Plus size={18} />
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
          {/if}
        </div>

        <div class="p-6 bg-white border-t border-gray-100 flex flex-col gap-4">
          {#if error}
            <div class="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3 text-red-700 animate-in shake-in-1">
              <Info size={18} class="shrink-0 mt-0.5" />
              <p class="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          {/if}

          <Button 
            onclick={submit}
            disabled={submitting || items.length === 0}
            variant="primary"
            class="w-full py-6 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:bg-indigo-700 hover:shadow-none hover:translate-y-1 transition-all disabled:opacity-30 disabled:shadow-none disabled:translate-y-0"
          >
            {#if submitting}
              <RefreshCw size={20} class="animate-spin mr-3" />
              Finalizing...
            {:else}
              <Check size={20} class="mr-3" />
              Confirm Transaction
            {/if}
          </Button>
        </div>
      </Card>
    </div>

  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #f1f1f1;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #e5e7eb;
  }
  
  :global(.custom-scrollbar) {
    scrollbar-width: thin;
    scrollbar-color: #f1f1f1 transparent;
  }
</style>
