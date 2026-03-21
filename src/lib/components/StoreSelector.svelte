<script lang="ts">
  /**
   * Store selector — lets the admin switch which store they're managing.
   * Stores the selected store slug in localStorage as 'pc_store_slug'.
   * Dispatches 'store-changed' CustomEvent with detail = slug string.
   */
  import { ChevronDown } from 'lucide-svelte';

  interface Store { id: number; slug: string; name: string; active: number; }

  let stores = $state<Store[]>([]);
  let selectedSlug = $state<string | null>(null);
  let open = $state(false);

  let selected = $derived(stores.find(s => s.slug === selectedSlug) ?? null);

  function token() { return localStorage.getItem('pc_token') ?? ''; }

  async function loadStores() {
    const res = await fetch('/api/stores', { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) return;
    stores = await res.json();
    const saved = localStorage.getItem('pc_store_slug') ?? '';
    selectedSlug = stores.find(s => s.slug === saved)?.slug ?? stores[0]?.slug ?? null;
    if (selectedSlug) localStorage.setItem('pc_store_slug', selectedSlug);
    // Notify pages of the initially selected store
    if (selectedSlug) {
      const s = stores.find(x => x.slug === selectedSlug)!;
      document.dispatchEvent(new CustomEvent('store-changed', { detail: { slug: s.slug, id: s.id } }));
    }
  }

  function select(s: Store) {
    selectedSlug = s.slug;
    localStorage.setItem('pc_store_slug', s.slug);
    open = false;
    document.dispatchEvent(new CustomEvent('store-changed', { detail: { slug: s.slug, id: s.id } }));
  }

  $effect(() => { loadStores(); });
</script>

{#if stores.length > 0}
  <div class="relative">
    <button
      onclick={() => (open = !open)}
      class="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <span class="font-medium">{selected?.name ?? 'Select store'}</span>
      <ChevronDown class="w-3.5 h-3.5 text-gray-400" />
    </button>

    {#if open}
      <div class="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-48 py-1">
        {#each stores as s}
          <button
            onclick={() => select(s)}
            class="flex items-center justify-between w-full px-4 py-2 text-sm hover:bg-gray-50
              {s.slug === selectedSlug ? 'text-blue-700 font-medium' : 'text-gray-700'}"
          >
            <span>{s.name}</span>
            {#if !s.active}<span class="text-xs text-gray-400">inactive</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
