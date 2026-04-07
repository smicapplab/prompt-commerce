<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';
  import type { Review } from '$lib/types/catalog.js';

  let reviews = $state<Review[]>([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let page = $state(1);
  const limit: number = 20;
  let q = $state("");
  let filterRating = $state("");

  // Delete confirm
  let deleteId = $state<number | null>(null);

  const token = () => localStorage.getItem('pc_token') ?? '';

  async function load(sid = activeStore.slug) {
    if (!sid) return;
    loading = true;
    const params = new URLSearchParams({ store: sid, page: String(page), limit: String(limit), q, rating: filterRating });
    const res = await fetch(`/api/reviews?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
    loading = false;
    if (res.ok) {
      const data = await res.json();
      reviews = data.reviews;
      totalCount = data.totalCount;
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/reviews/${deleteId}?store=${activeStore.slug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    });
    deleteId = null;
    await load();
  }

  async function search() { page = 1; await load(); }
  const totalPages = $derived(Math.ceil(totalCount / limit));

  function stars(n: number) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function starColor(n: number) {
    if (n >= 4) return 'text-amber-400';
    if (n === 3) return 'text-amber-300';
    return 'text-red-400';
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Average rating
  const avgRating = $derived(
    reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'
  );

  onMount(() => {
    if (activeStore.slug) { load(activeStore.slug); }
  });
</script>

<svelte:head><title>Reviews — Prompt Commerce</title></svelte:head>

<div class="p-6">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-4">
      <h1 class="text-xl font-semibold text-gray-900">Reviews</h1>
      {#if totalCount > 0}
        <div class="flex items-center gap-1.5 bg-amber-50 rounded-full px-3 py-1">
          <span class="text-amber-500 text-sm">★</span>
          <span class="text-sm font-semibold text-amber-700">{avgRating}</span>
          <span class="text-xs text-amber-600">({totalCount})</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-3 mb-5">
    <input
      type="search"
      placeholder="Search customer, product, comment…"
      bind:value={q}
      onkeydown={(e) => e.key === 'Enter' && search()}
      class="rounded-lg border border-gray-300 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
    <select bind:value={filterRating} onchange={search} class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
      <option value="">All ratings</option>
      {#each [5,4,3,2,1] as r}
        <option value={String(r)}>{'★'.repeat(r)} {r} star{r !== 1 ? 's' : ''}</option>
      {/each}
    </select>
    <button onclick={search} class="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">Search</button>
  </div>

  <!-- Cards Grid -->
  {#if loading}
    <div class="py-12 text-center text-gray-400 text-sm">Loading…</div>
  {:else if !activeStore.slug}
    <div class="py-12 text-center text-gray-400 text-sm">Select a store to see reviews.</div>
  {:else if reviews.length === 0}
    <div class="py-12 text-center text-gray-400 text-sm">No reviews found.</div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each reviews as review}
        <div class="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">{review.customer_name ?? 'Anonymous'}</p>
              <p class="text-xs text-gray-500 mt-0.5">{review.product_title ?? 'Unknown product'}</p>
            </div>
            <button
              onclick={() => (deleteId = review.id)}
              class="text-gray-300 hover:text-red-500 transition-colors"
              title="Delete review"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>

          <div class="flex items-center gap-1">
            <span class="text-base {starColor(review.rating)}">{stars(review.rating)}</span>
          </div>

          {#if review.comment}
            <p class="text-sm text-gray-700 line-clamp-3">{review.comment}</p>
          {:else}
            <p class="text-sm text-gray-400 italic">No comment.</p>
          {/if}

          <p class="text-xs text-gray-400 mt-auto">{formatDate(review.created_at)}</p>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between mt-6 text-sm text-gray-600">
        <span>{totalCount} reviews</span>
        <div class="flex gap-2">
          <button onclick={() => { page--; load(); }} disabled={page <= 1} class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Prev</button>
          <span class="px-3 py-1.5">Page {page} of {totalPages}</span>
          <button onclick={() => { page++; load(); }} disabled={page >= totalPages} class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Next</button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Delete Confirm -->
{#if deleteId}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
      <h2 class="text-base font-semibold text-gray-900 mb-2">Delete Review?</h2>
      <p class="text-sm text-gray-600 mb-6">This review will be permanently removed.</p>
      <div class="flex justify-end gap-3">
        <button onclick={() => (deleteId = null)} class="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">Cancel</button>
        <button onclick={confirmDelete} class="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>
      </div>
    </div>
  </div>
{/if}
