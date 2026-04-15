<script lang="ts">
  import { RefreshCw, X } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import type { Order } from "$lib/types/orders.js";

  let { 
    order,
    showingTrackingForm = $bindable(false), 
    showingCancelForm = $bindable(false),
    onSaveTracking,
    onSaveCancel
  } = $props<{ 
    order: Order,
    showingTrackingForm: boolean,
    showingCancelForm: boolean,
    onSaveTracking: (fields: Record<string, any>) => Promise<boolean>,
    onSaveCancel: (fields: Record<string, any>) => Promise<boolean>
  }>();

  // ── Tracking Info Edit State ────────────────────────────────────
  let editTrackingNumber = $state("");
  let editCourierName = $state("");
  let editTrackingUrl = $state("");
  let savingTracking = $state(false);

  // ── Cancellation Reason Edit State ──────────────────────────────
  let editCancelReason = $state("");
  let savingCancel = $state(false);

  $effect(() => {
    if (showingTrackingForm && order) {
      editTrackingNumber = order.tracking_number ?? "";
      editCourierName = order.courier_name ?? "";
      editTrackingUrl = order.tracking_url ?? "";
    }
  });

  $effect(() => {
    if (showingCancelForm && order) {
      editCancelReason = order.cancellation_reason ?? "";
    }
  });

  async function saveTracking() {
    savingTracking = true;
    const ok = await onSaveTracking({
      status: "in_transit",
      tracking_number: editTrackingNumber,
      courier_name: editCourierName,
      tracking_url: editTrackingUrl,
    });
    savingTracking = false;
    if (ok) showingTrackingForm = false;
  }

  async function saveCancel() {
    savingCancel = true;
    const ok = await onSaveCancel({
      status: "cancelled",
      cancellation_reason: editCancelReason,
    });
    savingCancel = false;
    if (ok) showingCancelForm = false;
  }
</script>

<!-- Tracking Modal -->
<Modal
  bind:show={showingTrackingForm}
  title="Shipping Details"
  description="Enter carrier information for the buyer."
  maxWidth="max-w-sm"
>
  <div class="space-y-6">
    <Input
      id="courier"
      label="Courier Name"
      bind:value={editCourierName}
      placeholder="e.g. Lalamove, Grab, J&T"
      required
    />
    <Input
      id="tracking"
      label="Tracking Number"
      bind:value={editTrackingNumber}
      placeholder="e.g. TRK-12345678"
      required
    />
    <Input
      id="url"
      label="Tracking URL"
      bind:value={editTrackingUrl}
      placeholder="https://..."
      description="Optional link for real-time tracking."
    />
  </div>

  {#snippet footer()}
    <Button
      onclick={() => (showingTrackingForm = false)}
      variant="secondary"
      class="flex-1"
    >
      Cancel
    </Button>
    <Button
      onclick={saveTracking}
      disabled={savingTracking || !editCourierName || !editTrackingNumber}
      variant="primary"
      class="flex-1"
    >
      {#if savingTracking}
        <RefreshCw size={16} class="animate-spin mr-2" />
      {/if}
      Save & Update
    </Button>
  {/snippet}
</Modal>

<!-- Cancellation Modal -->
<Modal
  bind:show={showingCancelForm}
  title="Cancel Order?"
  description="This will notify the customer and stop all processing. This action cannot be undone."
  maxWidth="max-w-sm"
>
  <div class="text-center">
    <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
      <X size={32} />
    </div>

    <div class="text-left mb-2">
      <label for="reason" class="block text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Reason for Cancellation</label>
      <textarea
        id="reason"
        bind:value={editCancelReason}
        placeholder="e.g. Out of stock, customer requested refund..."
        rows="3"
        class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none transition-all resize-none font-medium"
      ></textarea>
    </div>
  </div>

  {#snippet footer()}
    <Button
      onclick={() => (showingCancelForm = false)}
      variant="secondary"
      class="flex-1"
    >
      Keep Order
    </Button>
    <Button
      onclick={saveCancel}
      disabled={savingCancel || !editCancelReason.trim()}
      variant="primary"
      class="flex-1 bg-red-600 hover:bg-red-700 font-black border-none"
    >
      {#if savingCancel}
        <RefreshCw size={16} class="animate-spin mr-2" />
      {/if}
      Cancel Order
    </Button>
  {/snippet}
</Modal>
