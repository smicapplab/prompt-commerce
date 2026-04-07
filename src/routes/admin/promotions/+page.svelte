<script lang="ts">
  import { onMount } from "svelte";
  import { RefreshCw } from "@lucide/svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import type { Promotion, Product } from "$lib/types/catalog.js";

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
  let saving = $state(false);
  let syncError = $state("");
  let formError = $state("");

  // Form fields
  let fTitle = $state("");
  let fProductId = $state("");
  let fVoucherCode = $state("");
  let fDiscountType = $state<"percentage" | "fixed">("percentage");
  let fDiscountValue = $state("");
  let fStartDate = $state("");
  let fEndDate = $state("");
  let fActive = $state(true);

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
    fTitle = "";
    fProductId = "";
    fVoucherCode = "";
    fDiscountType = "percentage";
    fDiscountValue = "";
    fStartDate = "";
    fEndDate = "";
    fActive = true;
    formError = "";
    showModal = true;
  }

  function openEdit(p: Promotion) {
    editingId = p.id;
    fTitle = p.title;
    fProductId = p.product_id ? String(p.product_id) : "";
    fVoucherCode = p.voucher_code ?? "";
    fDiscountType = p.discount_type;
    fDiscountValue = String(p.discount_value);
    fStartDate = p.start_date ? p.start_date.slice(0, 10) : "";
    fEndDate = p.end_date ? p.end_date.slice(0, 10) : "";
    fActive = p.active;
    formError = "";
    showModal = true;
  }

  async function savePromotion() {
    if (!fTitle.trim()) {
      formError = "Title is required";
      return;
    }
    if (!fDiscountValue || isNaN(parseFloat(fDiscountValue))) {
      formError = "Discount value is required";
      return;
    }

    saving = true;
    formError = "";
    const body = {
      title: fTitle.trim(),
      product_id: fProductId ? parseInt(fProductId) : null,
      voucher_code: fVoucherCode.trim() || null,
      discount_type: fDiscountType,
      discount_value: parseFloat(fDiscountValue),
      start_date: fStartDate || null,
      end_date: fEndDate || null,
      active: fActive ? 1 : 0,
    };

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
      showModal = false;
      await load();
    } else {
      const data = await res.json();
      formError = (data as any).error ?? "Failed to save";
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
  const totalPages = $derived(Math.ceil(totalCount / limit));

  function formatDiscount(p: Promotion) {
    return p.discount_type === "percentage"
      ? `${p.discount_value}%`
      : `−${p.discount_value}`;
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatRelativeDate(d: string | null, prefix = "") {
    if (!d) return "";
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return prefix + "today";
    if (diffDays === 1) return prefix + "tomorrow";
    if (diffDays === -1) return prefix + "yesterday";
    if (diffDays > 1 && diffDays < 14) return prefix + `in ${diffDays} days`;
    if (diffDays < -1 && diffDays > -14)
      return prefix + `${Math.abs(diffDays)} days ago`;
    return "";
  }

  function isActive(p: Promotion) {
    const now = new Date();
    if (!p.active) return false;
    if (p.start_date && new Date(p.start_date) > now) return false;
    if (p.end_date && new Date(p.end_date) < now) return false;
    return true;
  }

  onMount(() => {
    if (activeStore.slug) {
      fetchProducts(activeStore.slug);
      load(activeStore.slug);
    }
  });
</script>

<svelte:head><title>Promotions — Prompt Commerce</title></svelte:head>

<div class="p-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-xl font-semibold text-gray-900">Promotions</h1>
    <button
      onclick={openCreate}
      class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        /></svg
      >
      Add Promotion
    </button>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-3 mb-5">
    <input
      type="search"
      placeholder="Search title or code…"
      bind:value={q}
      onkeydown={(e) => e.key === "Enter" && search()}
      class="rounded-lg border border-gray-300 px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
    <select
      bind:value={filterActive}
      onchange={search}
      class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <option value="">All status</option>
      <option value="1">Active</option>
      <option value="0">Inactive</option>
    </select>
    <button
      onclick={search}
      class="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
      >Search</button
    >
  </div>

  <!-- Table -->
  <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
    <table class="min-w-full text-sm">
      <thead>
        <tr
          class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          <th class="px-4 py-3">Promotion</th>
          <th class="px-4 py-3">Voucher Code</th>
          <th class="px-4 py-3">Discount</th>
          <th class="px-4 py-3">Product</th>
          <th class="px-4 py-3">Validity</th>
          <th class="px-4 py-3">Status</th>
          <th class="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        {#if loading}
          <tr
            ><td colspan="7" class="px-4 py-12 text-center text-gray-400"
              >Loading…</td
            ></tr
          >
        {:else if promotions.length === 0}
          <tr
            ><td colspan="7" class="px-4 py-16 text-center">
              <div
                class="flex flex-col items-center justify-center text-gray-400"
              >
                <svg
                  class="h-10 w-10 mb-2 opacity-20"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.703 2.703 0 00-3 0 2.704 2.704 0 01-3 0 2.705 2.705 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 16v2m3-6v6m3-3v3M9 12h6M4 17.75V4.25C4 3.01 5.01 2 6.25 2h11.5c1.24 0 2.25 1.01 2.25 2.25v13.5c0 1.24-1.01 2.25-2.25 2.25h-11.5C5.01 20 4 18.99 4 17.75z"
                  /></svg
                >
                <p class="text-sm font-medium">No promotions found</p>
                {#if q || filterActive}
                  <button
                    onclick={() => {
                      q = "";
                      filterActive = "";
                      search();
                    }}
                    class="mt-2 text-xs text-indigo-600 hover:underline"
                    >Clear filters</button
                  >
                {:else if activeStore.slug}
                  <button
                    onclick={openCreate}
                    class="mt-2 text-xs text-indigo-600 hover:underline"
                    >Create your first promotion</button
                  >
                {:else}
                  <p class="mt-1 text-xs">Select a store to see promotions.</p>
                {/if}
              </div>
            </td></tr
          >
        {:else}
          {#each promotions as promo}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium text-gray-900">{promo.title}</td>
              <td class="px-4 py-3">
                {#if promo.voucher_code}
                  <code
                    class="bg-gray-100 rounded px-2 py-0.5 text-xs font-mono"
                    >{promo.voucher_code}</code
                  >
                {:else}
                  <span class="text-gray-400">—</span>
                {/if}
              </td>
              <td class="px-4 py-3 font-semibold text-emerald-700"
                >{formatDiscount(promo)}</td
              >
              <td class="px-4 py-3 text-gray-600"
                >{promo.product_title ?? "All products"}</td
              >
              <td class="px-4 py-3 text-gray-600 text-[10px] leading-tight">
                <div class="flex flex-col">
                  <span class="font-medium text-gray-900"
                    >{formatDate(promo.start_date)} → {formatDate(
                      promo.end_date,
                    )}</span
                  >
                  {#if formatRelativeDate(promo.end_date, "Ends ")}
                    <span class="text-orange-600"
                      >{formatRelativeDate(promo.end_date, "Ends ")}</span
                    >
                  {/if}
                </div>
              </td>
              <td class="px-4 py-3">
                {#if isActive(promo)}
                  <span
                    class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    >Active</span
                  >
                {:else if !promo.active}
                  <span
                    class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                    >Disabled</span
                  >
                {:else}
                  <span
                    class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                    >Scheduled</span
                  >
                {/if}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  onclick={() => openEdit(promo)}
                  class="text-indigo-600 hover:text-indigo-800 mr-3 text-xs font-medium"
                  >Edit</button
                >
                <button
                  onclick={() => {
                    deleteId = promo.id;
                    deleteTitle = promo.title;
                  }}
                  class="text-red-600 hover:text-red-800 text-xs font-medium"
                  >Delete</button
                >
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>{totalCount} promotions</span>
      <div class="flex gap-2">
        <button
          onclick={() => {
            page--;
            load();
          }}
          disabled={page <= 1}
          class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >Prev</button
        >
        <span class="px-3 py-1.5">Page {page} of {totalPages}</span>
        <button
          onclick={() => {
            page++;
            load();
          }}
          disabled={page >= totalPages}
          class="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >Next</button
        >
      </div>
    </div>
  {/if}
</div>

<!-- Add / Edit Modal -->
{#if showModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    role="presentation"
    onkeydown={(e) => e.key === "Escape" && (showModal = false)}
  >
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-modal-title"
    >
      <div
        class="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10"
      >
        <h2
          id="promo-modal-title"
          class="text-base font-semibold text-gray-900"
        >
          {editingId ? "Edit Promotion" : "New Promotion"}
        </h2>
        <button
          onclick={() => (showModal = false)}
          class="text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Close modal">&times;</button
        >
      </div>

      <div class="px-6 py-5 space-y-4">
        {#if formError}
          <div
            class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
          >
            {formError}
          </div>
        {/if}

        <div>
          <label
            for="promo-title"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Title <span class="text-red-500">*</span></label
          >
          <input
            id="promo-title"
            type="text"
            bind:value={fTitle}
            placeholder="Summer Sale 20%"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label
              for="promo-type"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Discount Type <span class="text-red-500">*</span></label
            >
            <select
              id="promo-type"
              bind:value={fDiscountType}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </div>
          <div>
            <label
              for="promo-value"
              class="block text-sm font-medium text-gray-700 mb-1"
            >
              Value <span class="text-red-500">*</span>
              <span class="text-gray-400 font-normal"
                >{fDiscountType === "percentage" ? "(%)" : "(amount)"}</span
              >
            </label>
            <input
              id="promo-value"
              type="number"
              bind:value={fDiscountValue}
              min="0"
              step="0.01"
              placeholder="20"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label
            for="promo-code"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Voucher Code <span class="text-gray-400 font-normal"
              >(optional)</span
            ></label
          >
          <input
            id="promo-code"
            type="text"
            bind:value={fVoucherCode}
            placeholder="SUMMER20"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">
            Leave blank for automatic / no-code promotions.
          </p>
        </div>

        <div>
          <label
            for="promo-product"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Apply to Product <span class="text-gray-400 font-normal"
              >(optional)</span
            ></label
          >
          <select
            id="promo-product"
            bind:value={fProductId}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All products</option>
            {#each products as p}
              <option value={String(p.id)}>{p.title}</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label
              for="promo-start"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Start Date</label
            >
            <input
              id="promo-start"
              type="date"
              bind:value={fStartDate}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label
              for="promo-end"
              class="block text-sm font-medium text-gray-700 mb-1"
              >End Date</label
            >
            <input
              id="promo-end"
              type="date"
              bind:value={fEndDate}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            onclick={() => (fActive = !fActive)}
            aria-label={fActive ? "Deactivate promotion" : "Activate promotion"}
            aria-pressed={fActive}
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {fActive
              ? 'bg-indigo-600'
              : 'bg-gray-200'}"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {fActive
                ? 'translate-x-6'
                : 'translate-x-1'}"
            ></span>
          </button>
          <span class="text-sm text-gray-700">Active</span>
        </div>
      </div>

      <div
        class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 mt-auto"
      >
        <button
          onclick={() => (showModal = false)}
          class="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 outline-none"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          onclick={savePromotion}
          disabled={saving}
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 outline-none disabled:opacity-50"
        >
          {#if saving}
            <RefreshCw size={16} class="animate-spin" />
            {editingId ? "Updating…" : "Creating…"}
          {:else}
            {editingId ? "Save changes" : "Create Promotion"}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirm -->
{#if deleteId}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
  >
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
      <h2 class="text-base font-semibold text-gray-900 mb-2">
        Delete Promotion?
      </h2>
      <p class="text-sm text-gray-600 mb-6">
        "<span class="font-medium">{deleteTitle}</span>" will be permanently
        removed.
      </p>
      <div class="flex justify-end gap-3">
        <button
          onclick={() => (deleteId = null)}
          class="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >Cancel</button
        >
        <button
          onclick={confirmDelete}
          class="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
          >Delete</button
        >
      </div>
    </div>
  </div>
{/if}
