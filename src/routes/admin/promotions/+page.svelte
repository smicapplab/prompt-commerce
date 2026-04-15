<script lang="ts">
  import { onMount } from "svelte";
  import {
    RefreshCw,
    Plus,
    Search,
    Trash2,
    Pencil,
    Calendar,
    Ticket,
    Percent,
    Banknote,
    RotateCw,
  } from "@lucide/svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
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

  import { ChevronLeft, ChevronRight, X } from "@lucide/svelte";

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

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-black text-gray-900 tracking-tight">Promotions</h1>
    <Button onclick={openCreate} variant="primary">
      <Plus size={18} />
      Add Promotion
    </Button>
  </div>

  <!-- Filters -->
  <Card class="p-4 mb-6">
    <div class="flex flex-col md:flex-row gap-4">
      <div class="flex-1 relative">
        <Search
          size={18}
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <Input
          type="search"
          placeholder="Search title or code…"
          bind:value={q}
          onkeydown={(e: KeyboardEvent) => e.key === "Enter" && search()}
          class="pl-10"
        />
      </div>
      <div class="flex gap-4">
        <Select
          bind:value={filterActive}
          onchange={search}
          class="w-40"
          options={[
            { value: "", label: "All Status" },
            { value: "1", label: "Active" },
            { value: "0", label: "Inactive" },
          ]}
        />
        <Button onclick={search} variant="secondary">Search</Button>
      </div>
    </div>
  </Card>

  <!-- Table -->
  <Card class="overflow-hidden p-0">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50/80 border-b border-gray-100">
          <tr>
            <th
              class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
              >Promotion</th
            >
            <th
              class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
              >Code</th
            >
            <th
              class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
              >Discount</th
            >
            <th
              class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
              >Product</th
            >
            <th
              class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
              >Validity</th
            >
            <th
              class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
              >Status</th
            >
            <th
              class="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-400"
              >Actions</th
            >
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#if loading}
            <tr>
              <td
                colspan="7"
                class="px-6 py-12 text-center text-gray-400 animate-pulse font-medium"
              >
                Loading promotions...
              </td>
            </tr>
          {:else if promotions.length === 0}
            <tr>
              <td colspan="7" class="px-6 py-20 text-center">
                <div
                  class="flex flex-col items-center justify-center max-w-sm mx-auto text-gray-400"
                >
                  <div
                    class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"
                  >
                    <Ticket size={24} class="opacity-40" />
                  </div>
                  <h3 class="text-lg font-bold text-gray-900 mb-1">
                    No promotions found
                  </h3>
                  <p class="text-sm">
                    {#if q || filterActive}
                      No promotions match your current search or filters.
                    {:else}
                      You haven't added any promotions to this store yet.
                    {/if}
                  </p>
                  {#if q || filterActive}
                    <Button
                      variant="secondary"
                      size="sm"
                      onclick={() => {
                        q = "";
                        filterActive = "";
                        search();
                      }}
                      class="mt-6"
                    >
                      <RotateCw /> Clear filters
                    </Button>
                  {:else}
                    <Button variant="primary" onclick={openCreate} class="mt-6">
                      <Plus /> Create your first promotion
                    </Button>
                  {/if}
                </div>
              </td>
            </tr>
          {:else}
            {#each promotions as promo}
              <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="px-6 py-4">
                  <div class="font-bold text-gray-900">{promo.title}</div>
                  <div class="text-[10px] text-gray-400 font-medium mt-0.5">
                    ID: {promo.id}
                  </div>
                </td>
                <td class="px-6 py-4">
                  {#if promo.voucher_code}
                    <Badge
                      variant="secondary"
                      class="font-mono text-[10px] border-none"
                    >
                      {promo.voucher_code}
                    </Badge>
                  {:else}
                    <span class="text-gray-300 text-xs italic">Automatic</span>
                  {/if}
                </td>
                <td class="px-6 py-4">
                  <div
                    class="flex items-center gap-1.5 font-black text-emerald-600"
                  >
                    {#if promo.discount_type === "percentage"}
                      <Percent size={14} />
                    {:else}
                      <Banknote size={14} />
                    {/if}
                    {formatDiscount(promo)}
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span class="text-xs font-medium text-gray-600">
                    {promo.product_title ?? "All products"}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col gap-1">
                    <div
                      class="flex items-center gap-1.5 text-[10px] font-bold text-gray-900"
                    >
                      <Calendar size={12} class="text-gray-400" />
                      <span
                        >{formatDate(promo.start_date)} — {formatDate(
                          promo.end_date,
                        )}</span
                      >
                    </div>
                    {#if formatRelativeDate(promo.end_date, "Ends ")}
                      <Badge
                        class="bg-orange-50 text-orange-600 border-none px-1 text-[9px] w-fit"
                      >
                        {formatRelativeDate(promo.end_date, "Ends ")}
                      </Badge>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4">
                  {#if isActive(promo)}
                    <Badge
                      class="bg-emerald-50 text-emerald-700 border-emerald-100"
                      >Active</Badge
                    >
                  {:else if !promo.active}
                    <Badge class="bg-gray-100 text-gray-500 border-gray-200"
                      >Disabled</Badge
                    >
                  {:else}
                    <Badge class="bg-amber-50 text-amber-700 border-amber-100"
                      >Scheduled</Badge
                    >
                  {/if}
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onclick={() => openEdit(promo)}
                      class="p-2 border-none h-auto"
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onclick={() => {
                        deleteId = promo.id;
                        deleteTitle = promo.title;
                      }}
                      class="p-2 border-none h-auto text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </Card>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-8 flex items-center justify-between">
      <div
        class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]"
      >
        Page {page} of {totalPages} ({totalCount} items)
      </div>
      <div class="flex gap-2">
        <Button
          onclick={() => {
            page--;
            load();
          }}
          disabled={page <= 1}
          variant="secondary"
          size="sm"
          class="flex items-center gap-1 border-gray-200"
        >
          <ChevronLeft size={16} />
          Previous
        </Button>
        <Button
          onclick={() => {
            page++;
            load();
          }}
          disabled={page >= totalPages}
          variant="secondary"
          size="sm"
          class="flex items-center gap-1 border-gray-200"
        >
          Next
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  {/if}
</div>

<!-- Add / Edit Modal -->
{#if showModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    onclick={(e) => e.target === e.currentTarget && (showModal = false)}
    role="presentation"
    onkeydown={(e) => e.key === "Escape" && (showModal = false)}
  >
    <Card
      class="w-full max-w-lg shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-modal-title"
    >
      <div
        class="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50"
      >
        <h2 id="promo-modal-title" class="text-xl font-black text-gray-900">
          {editingId ? "Edit Promotion" : "New Promotion"}
        </h2>
        <Button
          onclick={() => (showModal = false)}
          variant="secondary"
          size="sm"
          class="p-1 border-none h-auto text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </Button>
      </div>

      <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
        {#if formError}
          <div
            class="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium"
          >
            {formError}
          </div>
        {/if}

        <Input
          id="promo-title"
          label="Title"
          bind:value={fTitle}
          placeholder="e.g. Summer Sale 20%"
          required
        />

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label
              for="promo-type"
              class="text-[11px] font-black uppercase tracking-widest text-gray-400 px-1"
              >Type</label
            >
            <Select
              id="promo-type"
              bind:value={fDiscountType}
              options={[
                { value: "percentage", label: "Percentage (%)" },
                { value: "fixed", label: "Fixed Amount" },
              ]}
            />
          </div>
          <Input
            id="promo-value"
            label="Value"
            type="number"
            bind:value={fDiscountValue}
            placeholder="20"
            required
          />
        </div>

        <Input
          id="promo-code"
          label="Voucher Code"
          bind:value={fVoucherCode}
          placeholder="e.g. SUMMER20"
          class="uppercase font-mono"
          description="Leave blank for automatic/no-code promotions."
        />

        <div class="space-y-1.5">
          <label
            for="promo-product"
            class="text-[11px] font-black uppercase tracking-widest text-gray-400 px-1"
            >Apply to Product</label
          >
          <Select
            id="promo-product"
            bind:value={fProductId}
            options={[
              { value: "", label: "All Products (Store-wide)" },
              ...products.map((p) => ({
                value: p.id.toString(),
                label: p.title,
              })),
            ]}
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <Input
            id="promo-start"
            label="Start Date"
            type="date"
            bind:value={fStartDate}
          />
          <Input
            id="promo-end"
            label="End Date"
            type="date"
            bind:value={fEndDate}
          />
        </div>

        <Toggle
          label="Active Status"
          description="Enable or disable this promotion manually."
          bind:checked={fActive}
        />
      </div>

      <div class="flex gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
        <Button
          onclick={() => (showModal = false)}
          variant="secondary"
          class="flex-1"
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onclick={savePromotion}
          variant="primary"
          class="flex-1"
          disabled={saving}
        >
          {#if saving}
            <RefreshCw size={16} class="animate-spin" />
            Saving...
          {:else}
            {editingId ? "Update Promotion" : "Create Promotion"}
          {/if}
        </Button>
      </div>
    </Card>
  </div>
{/if}

<!-- Delete Confirm -->
{#if deleteId}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    onclick={(e) => e.target === e.currentTarget && (deleteId = null)}
    role="presentation"
  >
    <Card
      class="w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95 duration-200"
    >
      <div class="flex flex-col items-center text-center">
        <div
          class="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4"
        >
          <Trash2 size={24} />
        </div>
        <h2 class="text-lg font-black text-gray-900 mb-2">Delete Promotion?</h2>
        <p class="text-sm text-gray-500">
          The promotion "<span class="font-bold text-gray-900"
            >{deleteTitle}</span
          >" and its voucher code will be permanently removed.
        </p>
      </div>
      <div class="flex gap-3 mt-8">
        <Button
          onclick={() => (deleteId = null)}
          variant="secondary"
          class="flex-1"
        >
          Cancel
        </Button>
        <Button
          onclick={confirmDelete}
          variant="primary"
          class="flex-1 bg-red-600 hover:bg-red-700"
        >
          Delete
        </Button>
      </div>
    </Card>
  </div>
{/if}
