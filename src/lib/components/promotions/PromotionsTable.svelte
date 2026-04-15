<script lang="ts">
  import {
    Plus,
    Trash2,
    Pencil,
    Calendar,
    Ticket,
    Percent,
    Banknote,
    RotateCw,
    ChevronLeft,
    ChevronRight,
  } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import type { Promotion } from "$lib/types/catalog.js";

  interface Props {
    promotions: Promotion[];
    loading: boolean;
    q: string;
    filterActive: string;
    onEdit: (p: Promotion) => void;
    onDelete: (p: Promotion) => void;
    onClearFilters: () => void;
    onCreate: () => void;
    page: number;
    totalCount: number;
    limit: number;
    onLoad: () => void;
  }

  let {
    promotions,
    loading,
    q,
    filterActive,
    onEdit,
    onDelete,
    onClearFilters,
    onCreate,
    page = $bindable(),
    totalCount,
    limit,
    onLoad,
  }: Props = $props();

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
</script>

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
                    onclick={onClearFilters}
                    class="mt-6"
                  >
                    <RotateCw /> Clear filters
                  </Button>
                {:else}
                  <Button variant="primary" onclick={onCreate} class="mt-6">
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
                    onclick={() => onEdit(promo)}
                    class="p-2 border-none h-auto"
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onclick={() => onDelete(promo)}
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
          onLoad();
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
          onLoad();
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
