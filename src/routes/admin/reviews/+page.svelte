<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';
  import type { Review } from '$lib/types/catalog.js';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { 
    Star, 
    Trash2, 
    Search, 
    Package, 
    User, 
    MessageSquare,
    Calendar,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    X
  } from '@lucide/svelte';

  let reviews = $state<Review[]>([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let page = $state(1);
  const limit: number = 20;
  let q = $state("");
  let filterRating = $state("");

  // Delete confirm
  let deleteId = $state<number | null>(null);
  let deleting = $state(false);

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
    deleting = true;
    const res = await fetch(`/api/reviews/${deleteId}?store=${activeStore.slug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    });
    deleting = false;
    if (res.ok) {
      deleteId = null;
      await load();
    }
  }

  async function handleSearch() { 
    page = 1; 
    await load(); 
  }

  const totalPages = $derived(Math.ceil(totalCount / limit));

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

<svelte:head>
  <title>Reviews — {activeStore.name || 'Prompt Commerce'}</title>
</svelte:head>

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
    <div class="flex items-center gap-4">
      <h1 class="text-3xl font-black text-gray-900 tracking-tight">Customer Reviews</h1>
      {#if totalCount > 0}
        <div class="flex items-center gap-2 bg-amber-50 rounded-2xl px-4 py-2 border border-amber-100 shadow-sm">
          <Star size={18} class="fill-amber-400 text-amber-400" />
          <span class="text-lg font-black text-amber-900 leading-none">{avgRating}</span>
          <span class="text-xs font-bold text-amber-600 uppercase tracking-widest ml-1">Avg Score</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Filter Toolbar -->
  <Card class="mb-10 p-4">
    <div class="flex flex-col md:flex-row gap-4 items-end">
      <div class="flex-1 w-full">
        <Input
          placeholder="Search by customer, product, or comment content..."
          bind:value={q}
          onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSearch()}
          class="w-full"
        >
          {#snippet icon()}
            <Search size={18} class="text-gray-400" />
          {/snippet}
        </Input>
      </div>
      <div class="w-full md:w-48">
        <label for="rating-filter" class="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Filter Rating</label>
        <Select 
          id="rating-filter"
          bind:value={filterRating} 
          onchange={handleSearch}
          options={[
            { value: "", label: "All Ratings" },
            { value: "5", label: "★★★★★ 5 Stars" },
            { value: "4", label: "★★★★☆ 4 Stars" },
            { value: "3", label: "★★★☆☆ 3 Stars" },
            { value: "2", label: "★★☆☆☆ 2 Stars" },
            { value: "1", label: "★☆☆☆☆ 1 Star" }
          ]}
        />
      </div>
      <Button onclick={handleSearch} variant="primary" size="lg" disabled={loading} class="w-full md:w-auto px-8">
        {#if loading}
          <RefreshCw size={18} class="animate-spin mr-2" />
        {/if}
        Apply Filters
      </Button>
    </div>
  </Card>

  <!-- Review Feed -->
  {#if loading && reviews.length === 0}
    <div class="py-24 text-center">
      <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse">Scanning customer feedback...</p>
    </div>
  {:else if !activeStore.slug}
    <div class="py-24 text-center">
      <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
        <Package size={32} />
      </div>
      <h2 class="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Select a Store</h2>
      <p class="text-sm font-medium text-gray-400">Choose a retailer to manage their product reviews.</p>
    </div>
  {:else if reviews.length === 0}
    <div class="py-24 text-center">
      <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
        <MessageSquare size={32} />
      </div>
      <h2 class="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Zero Feedback Found</h2>
      <p class="text-sm font-medium text-gray-400">Reviews will appear here once customers start sharing their experiences.</p>
    </div>
  {:else}
    <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {#each reviews as review}
        <Card class="flex flex-col h-full hover:shadow-lg transition-shadow duration-300">
          <div class="flex items-start justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-sm">
                {(review.customer_name ?? 'A')[0].toUpperCase()}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black text-gray-900 truncate leading-none mb-1">
                  {review.customer_name ?? 'Anonymous Buyer'}
                </p>
                <div class="flex items-center gap-1.5">
                  <Package size={12} class="text-gray-300" />
                  <p class="text-[10px] font-bold text-gray-400 truncate uppercase tracking-tight">
                    {review.product_title ?? 'Untitled Product'}
                  </p>
                </div>
              </div>
            </div>
            <button
              onclick={() => (deleteId = review.id)}
              class="text-gray-300 hover:text-red-500 transition-colors p-1"
              title="Delete review"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div class="flex items-center gap-1 mb-4">
            {#each Array(5) as _, i}
              <Star 
                size={16} 
                class="{i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} "
              />
            {/each}
          </div>

          <div class="flex-1">
            {#if review.comment}
              <p class="text-sm text-gray-700 font-medium leading-relaxed">
                "{review.comment}"
              </p>
            {:else}
              <p class="text-sm text-gray-400 italic">This customer didn't leave a written comment.</p>
            {/if}
          </div>

          <div class="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
            <div class="flex items-center gap-2 text-gray-400">
              <Calendar size={12} />
              <span class="text-[10px] font-black uppercase tracking-widest">{formatDate(review.created_at)}</span>
            </div>
            <Badge variant="secondary" class="font-bold bg-gray-50 border-none text-[9px] uppercase tracking-wide">
              Verified Purchase
            </Badge>
          </div>
        </Card>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-between mt-12 py-6 border-t border-gray-100">
        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
          Showing {reviews.length} of {totalCount} reviews
        </p>
        <div class="flex gap-3">
          <Button 
            onclick={() => { page--; load(); }} 
            disabled={page <= 1} 
            variant="secondary" 
            size="sm"
            class="px-4"
          >
            <ChevronLeft size={18} class="mr-1" />
            Previous
          </Button>
          <div class="flex items-center px-4 bg-gray-50 rounded-xl border border-gray-100">
            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">
              Page {page} of {totalPages}
            </span>
          </div>
          <Button 
            onclick={() => { page++; load(); }} 
            disabled={page >= totalPages} 
            variant="secondary" 
            size="sm"
            class="px-4"
          >
            Next
            <ChevronRight size={18} class="ml-1" />
          </Button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if deleteId}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div 
      class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
      onclick={() => (deleteId = null)}
      role="presentation"
    ></div>
    
    <Card class="w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 z-10">
      <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <Trash2 size={32} />
      </div>
      <h3 class="text-xl font-black text-gray-900 leading-tight mb-2">Delete Review?</h3>
      <p class="text-sm text-gray-400 font-medium mb-8">
        This will permanently remove the feedback from your store. This action cannot be undone.
      </p>

      <div class="flex gap-3">
        <Button
          onclick={() => (deleteId = null)}
          variant="secondary"
          class="flex-1 font-black"
        >
          Keep it
        </Button>
        <Button
          onclick={confirmDelete}
          disabled={deleting}
          variant="primary"
          class="flex-1 bg-red-600 hover:bg-red-700 font-black"
        >
          {#if deleting}
            <RefreshCw size={16} class="animate-spin mr-2" />
          {/if}
          Delete
        </Button>
      </div>
    </Card>
  </div>
{/if}
