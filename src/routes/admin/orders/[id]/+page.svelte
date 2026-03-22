<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';
  import { goto } from '$app/navigation';

  interface OrderItem {
    id: number;
    product_id: number | null;
    title: string;
    price: number;
    quantity: number;
    product_title: string | null;
    product_images: string[];
  }

  interface Order {
    id: number;
    buyer_ref: string | null;
    channel: string;
    status: string;
    total: number | null;
    notes: string | null;
    items: OrderItem[];
    created_at: string;
    updated_at: string;
  }

  const id = $derived(parseInt(page.params.id));
  let order = $state<Order | null>(null);
  let loading = $state(true);
  let updating = $state(false);

  const STATUS_STEPS = [
    { id: 'pending', label: 'Pending', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'paid', label: 'Paid', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'picking', label: 'Picking', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { id: 'packing', label: 'Packing', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
    { id: 'ready_for_pickup', label: 'Ready', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'in_transit', label: 'In Transit', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'delivered', label: 'Delivered', icon: 'M5 13l4 4L19 7' },
  ];

  const STATUS_COLORS: Record<string, string> = {
    pending:          'text-amber-600 bg-amber-50 border-amber-200',
    paid:             'text-blue-600 bg-blue-50 border-blue-200',
    picking:          'text-indigo-600 bg-indigo-50 border-indigo-200',
    packing:          'text-violet-600 bg-violet-50 border-violet-200',
    ready_for_pickup: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    in_transit:       'text-sky-600 bg-sky-50 border-sky-200',
    delivered:        'text-emerald-600 bg-emerald-50 border-emerald-200',
    cancelled:        'text-red-600 bg-red-50 border-red-200',
    refunded:         'text-gray-600 bg-gray-50 border-gray-200',
  };

  const token = () => localStorage.getItem('pc_token') ?? '';

  async function load() {
    loading = true;
    const res = await fetch(`/api/orders/${id}?store=${activeStore.slug}`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    loading = false;
    if (res.ok) {
      order = await res.json();
    } else {
      goto('/admin/orders');
    }
  }

  async function updateStatus(status: string) {
    if (!order || updating) return;
    updating = true;
    const res = await fetch(`/api/orders/${id}?store=${activeStore.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status })
    });
    updating = false;
    if (res.ok) {
      const updated = await res.json();
      order = { ...order, ...updated };
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PH', { 
      year: 'numeric', month: 'long', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  }

  function formatCurrency(n: number | null) {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
  }

  onMount(() => {
    if (activeStore.slug) load();
  });

  const currentStepIndex = $derived(STATUS_STEPS.findIndex(s => s.id === order?.status));
  const nextStep = $derived(currentStepIndex >= 0 && currentStepIndex < STATUS_STEPS.length - 1 ? STATUS_STEPS[currentStepIndex + 1] : null);
</script>

<svelte:head><title>Order #{String(id).padStart(6, '0')} — Prompt Commerce</title></svelte:head>

<div class="p-6 max-w-5xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex items-center gap-4 mb-8">
    <button 
      onclick={() => goto('/admin/orders')}
      class="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
      aria-label="Back to orders list"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
    </button>
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-gray-900">Order #{String(id).padStart(6, '0')}</h1>
        {#if order}
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border {STATUS_COLORS[order.status]}">
            {order.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </span>
        {/if}
      </div>
      {#if order}
        <p class="text-sm text-gray-500 mt-1">Placed on {formatDate(order.created_at)}</p>
      {/if}
    </div>
    
    <div class="ml-auto flex items-center gap-3">
      {#if order && order.status !== 'cancelled' && order.status !== 'delivered'}
        <button 
          onclick={() => updateStatus('cancelled')}
          class="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
        >
          Cancel Order
        </button>
      {/if}
      {#if nextStep}
        <button 
          onclick={() => updateStatus(nextStep.id)}
          disabled={updating}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all active:scale-95 disabled:opacity-50"
        >
          {#if updating}
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          {/if}
          Mark as {nextStep.label}
        </button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="py-24 flex flex-col items-center gap-4">
      <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-gray-400 font-medium animate-pulse">Fetching order details...</p>
    </div>
  {:else if order}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Left Column: Details & Items -->
      <div class="lg:col-span-2 space-y-8">
        
        <!-- Status Stepper -->
        <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 class="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Order Progress</h2>
          <div class="relative">
            <div class="absolute top-5 left-0 w-full h-0.5 bg-gray-100">
              <div 
                class="h-full bg-indigo-600 transition-all duration-500" 
                style="width: {currentStepIndex >= 0 ? (currentStepIndex / (STATUS_STEPS.length - 1)) * 100 : 0}%"
              ></div>
            </div>
            <div class="relative flex justify-between">
              {#each STATUS_STEPS as step, i}
                <div class="flex flex-col items-center">
                  <div class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10 
                    {i <= currentStepIndex ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-300'}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={step.icon}/></svg>
                  </div>
                  <p class="mt-3 text-[10px] font-bold uppercase tracking-wide {i <= currentStepIndex ? 'text-indigo-600' : 'text-gray-400'}">
                    {step.label}
                  </p>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h2 class="text-sm font-bold text-gray-900 uppercase tracking-wider">Order Items</h2>
            <span class="text-xs font-bold text-gray-400 bg-white px-2 py-1 rounded border border-gray-100">{order.items.length} Items</span>
          </div>
          <table class="w-full text-left text-sm">
            <tbody class="divide-y divide-gray-100">
              {#each order.items as item}
                <tr class="group">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-4">
                      <div class="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden">
                        {#if item.product_images?.[0]}
                          <img src={item.product_images[0]} alt={item.title} class="w-full h-full object-cover">
                        {:else}
                          <div class="w-full h-full flex items-center justify-center text-gray-300 text-xs">NO IMG</div>
                        {/if}
                      </div>
                      <div>
                        <p class="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{item.title}</p>
                        <p class="text-xs text-gray-400 mt-0.5">Price per unit: {formatCurrency(item.price)}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <span class="text-gray-400 text-xs font-bold uppercase mr-1">Qty:</span>
                    <span class="font-bold text-gray-900">{item.quantity}</span>
                  </td>
                  <td class="px-6 py-4 text-right font-bold text-gray-900">
                    {formatCurrency(item.price * item.quantity)}
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot class="bg-gray-50/30">
              <tr class="border-t border-gray-200">
                <td colspan="2" class="px-6 py-4 text-sm font-medium text-gray-500 text-right uppercase tracking-wider">Grand Total</td>
                <td class="px-6 py-4 text-right text-lg font-black text-indigo-600">{formatCurrency(order.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Notes -->
        {#if order.notes}
          <div class="bg-amber-50 rounded-2xl border border-amber-100 p-6">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <h2 class="text-xs font-bold text-amber-700 uppercase tracking-widest">Order Notes</h2>
            </div>
            <p class="text-sm text-amber-900 font-medium leading-relaxed">{order.notes}</p>
          </div>
        {/if}
      </div>

      <!-- Right Column: Buyer & Meta -->
      <div class="space-y-8">
        
        <!-- Buyer Card -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 class="text-sm font-bold text-gray-900 uppercase tracking-wider">Buyer Information</h2>
          </div>
          <div class="p-6">
            <div class="flex items-center gap-4 mb-6">
              <div class="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg">
                {(order.buyer_ref ?? 'G')[0].toUpperCase()}
              </div>
              <div>
                <p class="font-bold text-gray-900">{order.buyer_ref ?? 'Guest Buyer'}</p>
                <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-600 mt-1">
                  {order.channel}
                </div>
              </div>
            </div>
            
            <button class="w-full rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all active:scale-95">
              View Customer History
            </button>
          </div>
        </div>

        <!-- Meta Data -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="p-6 space-y-4">
            <div>
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Source Channel</p>
              <p class="text-sm font-bold text-gray-900 capitalize">{order.channel || 'Direct'}</p>
            </div>
            <div class="pt-4 border-t border-gray-100">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Updated</p>
              <p class="text-sm font-bold text-gray-900">{formatDate(order.updated_at)}</p>
            </div>
          </div>
        </div>

        <!-- Action Links -->
        <div class="flex flex-col gap-2 font-bold text-xs">
          <button class="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gray-900 text-white hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Print Packing Slip
          </button>
          <button class="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all active:scale-95">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
            Export to Receipt PDF
          </button>
        </div>

      </div>
    </div>
  {/if}
</div>
