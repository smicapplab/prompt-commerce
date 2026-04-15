<script lang="ts">
  import { onMount } from "svelte";
  import { Plus } from "@lucide/svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import Button from "$lib/components/ui/Button.svelte";
  import type { Promotion, Product } from "$lib/types/catalog.js";

  // Components
  import PromotionsFilters from "$lib/components/promotions/PromotionsFilters.svelte";
  import PromotionsTable from "$lib/components/promotions/PromotionsTable.svelte";
  import PromotionFormModal from "$lib/components/promotions/PromotionFormModal.svelte";
  import PromotionDeleteModal from "$lib/components/promotions/PromotionDeleteModal.svelte";

  let promotions = $state<Promotion[]>([]);
  let products = $state<Product[]>([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let page = $state(1);
  const limit = 20;
  let q = $state("");
  let filterActive = $state("");

  // Modal state
  let showModal = $state(false);
  let editingId = $state<number | null>(null);
  let editingPromotion = $state<Promotion | null>(null);
  let saving = $state(false);
  let formError = $state("");

  // Delete confirm
  let deleteId = $state<number | null>(null);
  let deleteTitle = $state("");

  const token = () => localStorage.getItem("pc_token") ?? "";

  async function fetchProducts(sid: string) {
    const res = await fetch(`/api/products?store=${sid}&limit=200`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      const data = await res.json();
      products = data.products ?? [];
    }
  }

  async function load(sid = activeStore.slug) {
    if (!sid) return;
    loading = true;
    const params = new URLSearchParams({
      store: sid,
      page: String(page),
      limit: String(limit),
      q,
      active: filterActive,
    });
    const res = await fetch(`/api/promotions?${params}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    loading = false;
    if (res.ok) {
      const data = await res.json();
      promotions = data.promotions;
      totalCount = data.totalCount;
    }
  }

  function openCreate() {
    editingId = null;
    editingPromotion = null;
    formError = "";
    showModal = true;
  }

  function openEdit(p: Promotion) {
    editingId = p.id;
    editingPromotion = p;
    formError = "";
    showModal = true;
  }

  async function savePromotion(body: any) {
    saving = true;
    formError = "";

    const url = editingId
      ? `/api/promotions/${editingId}?store=${activeStore.slug}`
      : `/api/promotions?store=${activeStore.slug}`;
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(body),
    });
    saving = false;

    if (res.ok) {
      await load();
      return true;
    } else {
      const data = await res.json();
      formError = (data as any).error ?? "Failed to save";
      return false;
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/promotions/${deleteId}?store=${activeStore.slug}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    deleteId = null;
    await load();
  }

  async function search() {
    page = 1;
    await load();
  }

  function clearFilters() {
    q = "";
    filterActive = "";
    search();
  }

  onMount(() => {
    if (activeStore.slug) {
      fetchProducts(activeStore.slug);
      load(activeStore.slug);
    }
  });
</script>

<svelte:head><title>Promotions — Prompt Commerce</title></svelte:head>

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-black text-gray-900 tracking-tight">Promotions</h1>
    <Button onclick={openCreate} variant="primary">
      <Plus size={18} />
      Add Promotion
    </Button>
  </div>

  <PromotionsFilters bind:q bind:filterActive onSearch={search} />

  <PromotionsTable
    {promotions}
    {loading}
    {q}
    {filterActive}
    onEdit={openEdit}
    onDelete={(p) => {
      deleteId = p.id;
      deleteTitle = p.title;
    }}
    onClearFilters={clearFilters}
    onCreate={openCreate}
    bind:page
    {totalCount}
    {limit}
    onLoad={load}
  />
</div>

<PromotionFormModal
  bind:show={showModal}
  {editingId}
  {products}
  onSave={savePromotion}
  {saving}
  bind:error={formError}
  initialData={editingPromotion}
/>

<PromotionDeleteModal
  bind:deleteId
  {deleteTitle}
  onConfirm={confirmDelete}
/>
