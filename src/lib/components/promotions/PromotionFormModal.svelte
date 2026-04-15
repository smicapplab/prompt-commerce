<script lang="ts">
  import { RefreshCw, X } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import type { Product, Promotion } from "$lib/types/catalog.js";

  interface Props {
    show: boolean;
    editingId: number | null;
    products: Product[];
    onSave: (body: any) => Promise<boolean>;
    saving: boolean;
    error: string;
    initialData?: Partial<Promotion> | null;
  }

  let {
    show = $bindable(),
    editingId,
    products,
    onSave,
    saving,
    error = $bindable(),
    initialData = null,
  }: Props = $props();

  // Form fields
  let fTitle = $state("");
  let fProductId = $state("");
  let fVoucherCode = $state("");
  let fDiscountType = $state<"percentage" | "fixed">("percentage");
  let fDiscountValue = $state("");
  let fStartDate = $state("");
  let fEndDate = $state("");
  let fActive = $state(true);

  $effect(() => {
    if (show) {
      if (editingId && initialData) {
        fTitle = initialData.title ?? "";
        fProductId = initialData.product_id ? String(initialData.product_id) : "";
        fVoucherCode = initialData.voucher_code ?? "";
        fDiscountType = initialData.discount_type ?? "percentage";
        fDiscountValue = String(initialData.discount_value ?? "");
        fStartDate = initialData.start_date ? initialData.start_date.slice(0, 10) : "";
        fEndDate = initialData.end_date ? initialData.end_date.slice(0, 10) : "";
        fActive = !!initialData.active;
      } else {
        fTitle = "";
        fProductId = "";
        fVoucherCode = "";
        fDiscountType = "percentage";
        fDiscountValue = "";
        fStartDate = "";
        fEndDate = "";
        fActive = true;
      }
      error = "";
    }
  });

  async function handleSave() {
    if (!fTitle.trim()) {
      error = "Title is required";
      return;
    }
    if (!fDiscountValue || isNaN(parseFloat(fDiscountValue))) {
      error = "Discount value is required";
      return;
    }

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

    const success = await onSave(body);
    if (success) {
      show = false;
    }
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    onclick={(e) => e.target === e.currentTarget && (show = false)}
    role="presentation"
    onkeydown={(e) => e.key === "Escape" && (show = false)}
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
          onclick={() => (show = false)}
          variant="secondary"
          size="sm"
          class="p-1 border-none h-auto text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </Button>
      </div>

      <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
        {#if error}
          <div
            class="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium"
          >
            {error}
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
          onclick={() => (show = false)}
          variant="secondary"
          class="flex-1"
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onclick={handleSave}
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
