<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import { page } from "$app/state";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { goto } from "$app/navigation";
  import type { Order } from "$lib/types/orders.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { 
    ChevronLeft, 
    RefreshCw, 
    Package, 
    CreditCard, 
    Truck, 
    MapPin, 
    Pencil, 
    Trash2, 
    Plus, 
    FileText, 
    Image as ImageIcon,
    Download,
    Paperclip,
    ArrowRight,
    CircleCheck,
    Clock,
    X,
    Printer,
    Link as LinkIcon,
    Store,
  } from "@lucide/svelte";

  let { data } = $props();

  const id = $derived(parseInt(page.params.id));
  let order = $state<Order | null>(null);
  let loading = $state(true);
  let updating = $state(false);

  // ── Inline edit state ───────────────────────────────────────────
  let editingBuyer = $state(false);
  let editBuyerRef = $state("");
  let editBuyerName = $state("");
  let editBuyerEmail = $state("");
  let editChannel = $state("");
  let savingBuyer = $state(false);

  let editingDelivery = $state(false);
  let editDeliveryType = $state("");
  let editDeliveryAddress = $state("");
  let savingDelivery = $state(false);

  let editingPayment = $state(false);
  let editPaymentProvider = $state("");
  let savingPayment = $state(false);

  let editingLocation = $state(false);
  let editLat = $state("");
  let editLng = $state("");
  let savingLocation = $state(false);

  let editingNotes = $state(false);
  let editNotesVal = $state("");
  let savingNotes = $state(false);

  // ── Notes & Files State ────────────────────────────────────────
  let orderNotes = $state<any[]>([]);
  let loadingNotes = $state(false);
  let showDeletedNotes = $state(false);
  let newNoteText = $state("");
  let addingNote = $state(false);

  let orderFiles = $state<any[]>([]);
  let loadingFiles = $state(false);
  let showDeletedFiles = $state(false);
  let uploadingFile = $state(false);

  import { CHANNELS, STATUS_STEPS, STATUS_COLORS } from "$lib/constants/orders.js";

  // ── Tracking Info Edit State ────────────────────────────────────
  let showingTrackingForm = $state(false);
  let editTrackingNumber = $state("");
  let editCourierName = $state("");
  let editTrackingUrl = $state("");
  let savingTracking = $state(false);

  // ── Cancellation Reason Edit State ──────────────────────────────
  let showingCancelForm = $state(false);
  let editCancelReason = $state("");
  let savingCancel = $state(false);

  const token = () => localStorage.getItem("pc_token") ?? "";

  async function load() {
    loading = true;
    const res = await fetch(`/api/orders/${id}?store=${activeStore.slug}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    loading = false;
    if (res.ok) {
      order = await res.json();
    } else {
      goto("/admin/orders");
    }
  }

  async function patch(fields: Record<string, unknown>) {
    const res = await fetch(`/api/orders/${id}?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (res.ok) {
      order = { ...order!, ...data };
      return true;
    } else {
      alert(data.error || "Failed to update order");
      return false;
    }
  }

  async function updateStatus(status: string) {
    if (!order || updating) return;

    // Intercept tracking info requirement
    if (
      status === "in_transit" &&
      (order as any).delivery_type === "delivery" &&
      !order.items.some((i) => (order as any).tracking_number)
    ) {
      editTrackingNumber = (order as any).tracking_number ?? "";
      editCourierName = (order as any).courier_name ?? "";
      editTrackingUrl = (order as any).tracking_url ?? "";
      showingTrackingForm = true;
      return;
    }

    // Intercept cancellation reason
    if (status === "cancelled") {
      editCancelReason = (order as any).cancellation_reason ?? "";
      showingCancelForm = true;
      return;
    }

    updating = true;
    await patch({ status });
    updating = false;
  }

  async function saveTracking() {
    savingTracking = true;
    const ok = await patch({
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
    const ok = await patch({
      status: "cancelled",
      cancellation_reason: editCancelReason,
    });
    savingCancel = false;
    if (ok) showingCancelForm = false;
  }

  // ── Notes ──────────────────────────────────────────────────────
  async function loadNotes() {
    loadingNotes = true;
    const res = await fetch(
      `/api/orders/${id}/notes?store=${activeStore.slug}&show_deleted=${showDeletedNotes ? 1 : 0}`,
      {
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (res.ok) orderNotes = await res.json();
    loadingNotes = false;
  }

  async function addNote() {
    if (!newNoteText.trim()) return;
    addingNote = true;
    const res = await fetch(
      `/api/orders/${id}/notes?store=${activeStore.slug}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ note: newNoteText }),
      },
    );
    if (res.ok) {
      newNoteText = "";
      await loadNotes();
    }
    addingNote = false;
  }

  async function deleteNote(noteId: number) {
    if (!confirm("Are you sure you want to delete this note?")) return;
    const res = await fetch(
      `/api/orders/${id}/notes/${noteId}?store=${activeStore.slug}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (res.ok) await loadNotes();
  }

  // ── Files ──────────────────────────────────────────────────────
  async function loadFiles() {
    loadingFiles = true;
    const res = await fetch(
      `/api/orders/${id}/files?store=${activeStore.slug}&show_deleted=${showDeletedFiles ? 1 : 0}`,
      {
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (res.ok) orderFiles = await res.json();
    loadingFiles = false;
  }

  async function uploadFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;

    uploadingFile = true;
    const formData = new FormData();
    formData.append("file", input.files[0]);

    const res = await fetch(
      `/api/orders/${id}/files?store=${activeStore.slug}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      },
    );
    if (res.ok) {
      await loadFiles();
    } else {
      const data = await res.json();
      alert(data.error || "Upload failed");
    }
    uploadingFile = false;
    input.value = ""; // Reset input
  }

  async function deleteFile(fileId: number) {
    if (!confirm("Are you sure you want to delete this file?")) return;
    const res = await fetch(
      `/api/orders/${id}/files/${fileId}?store=${activeStore.slug}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (res.ok) await loadFiles();
  }

  function startEditBuyer() {
    editBuyerRef = order?.buyer_ref ?? "";
    editBuyerName = (order as any)?.buyer_name ?? "";
    editBuyerEmail = (order as any)?.buyer_email ?? "";
    editChannel = order?.channel ?? "manual";
    editingBuyer = true;
  }

  async function saveBuyer() {
    savingBuyer = true;
    const ok = await patch({
      buyer_ref: editBuyerRef || null,
      buyer_name: editBuyerName || null,
      buyer_email: editBuyerEmail || null,
      channel: editChannel,
    });
    savingBuyer = false;
    if (ok) editingBuyer = false;
  }

  function startEditDelivery() {
    editDeliveryType = (order as any)?.delivery_type ?? "delivery";
    editDeliveryAddress = (order as any)?.delivery_address ?? "";
    editingDelivery = true;
  }

  async function saveDelivery() {
    savingDelivery = true;
    const ok = await patch({ 
      delivery_type: editDeliveryType,
      delivery_address: editDeliveryAddress || null
    });
    savingDelivery = false;
    if (ok) editingDelivery = false;
  }

  function startEditPayment() {
    editPaymentProvider = (order as any)?.payment_provider ?? "cod";
    editingPayment = true;
  }

  async function savePayment() {
    savingPayment = true;
    const ok = await patch({ payment_provider: editPaymentProvider });
    savingPayment = false;
    if (ok) editingPayment = false;
  }

  function startEditLocation() {
    editLat = order?.lat?.toString() ?? "";
    editLng = order?.lng?.toString() ?? "";
    editingLocation = true;
  }

  async function saveLocation() {
    savingLocation = true;
    const ok = await patch({ 
      lat: editLat ? parseFloat(editLat) : null,
      lng: editLng ? parseFloat(editLng) : null 
    });
    savingLocation = false;
    if (ok) editingLocation = false;
  }

  function startEditNotes() {
    editNotesVal = order?.notes ?? "";
    editingNotes = true;
  }

  async function saveNotes() {
    savingNotes = true;
    const ok = await patch({ notes: editNotesVal || null });
    savingNotes = false;
    if (ok) editingNotes = false;
  }

  // ── Print helpers ────────────────────────────────────────────────
  function printPackingSlip() {
    if (!order) return;
    const storeName = activeStore.name || "Store";
    const orderNum = String(order.id).padStart(6, "0");
    const itemRows = order.items
      .map(
        (i) =>
          `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${i.title}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${i.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">—</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Packing Slip — Order #${orderNum}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#111;padding:32px;max-width:600px}
    h1{font-size:20px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px}
    .sub{font-size:11px;color:#6b7280;margin-bottom:24px}
    .section{margin-bottom:20px}
    .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px}
    .value{font-size:13px;font-weight:600}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding-bottom:6px;border-bottom:2px solid #111;text-align:left}
    th:last-child,td:last-child{text-align:right}
    th:nth-child(2),td:nth-child(2){text-align:center}
    .dashed{border-top:2px dashed #d1d5db;margin:20px 0}
    .footer{font-size:10px;color:#9ca3af;text-align:center;margin-top:32px}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <h1>${storeName}</h1>
  <p class="sub">PACKING SLIP</p>

  <div style="display:flex;gap:40px;margin-bottom:24px">
    <div class="section">
      <p class="label">Order</p>
      <p class="value">#${orderNum}</p>
    </div>
    <div class="section">
      <p class="label">Date</p>
      <p class="value">${new Date(order.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
    <div class="section">
      <p class="label">Channel</p>
      <p class="value" style="text-transform:capitalize">${order.channel}</p>
    </div>
  </div>

  <div class="section">
    <p class="label">Ship To</p>
    <p class="value">${order.buyer_ref || "Guest Buyer"}</p>
    ${order.notes ? `<p style="font-size:12px;color:#374151;margin-top:4px">${order.notes}</p>` : ""}
  </div>

  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Qty</th>
        <th>Check</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <p class="footer">Please verify all items before shipping. Thank you!</p>
  <script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=700,height=800");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function printReceipt() {
    if (!order) return;
    const storeName = activeStore.name || "Store";
    const orderNum = String(order.id).padStart(6, "0");
    const itemRows = order.items
      .map(
        (i) =>
          `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${i.title}</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center;">${i.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${formatCurrency(i.price)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700">${formatCurrency(i.price * i.quantity)}</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt — Order #${orderNum}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#111;padding:40px;max-width:580px;margin:0 auto}
    .header{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #111}
    h1{font-size:22px;font-weight:900;letter-spacing:-0.5px}
    .receipt-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#6b7280;margin-top:4px}
    .meta{display:flex;justify-content:space-between;margin-bottom:24px;font-size:12px}
    .meta-block .label{font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;letter-spacing:.5px;margin-bottom:2px}
    .meta-block .value{font-weight:600}
    table{width:100%;border-collapse:collapse}
    thead th{font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;letter-spacing:.5px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;text-align:left}
    thead th:nth-child(2){text-align:center}
    thead th:nth-child(3),thead th:nth-child(4){text-align:right}
    .total-row td{padding:12px 0;font-size:15px;font-weight:900;color:#4f46e5;border-top:2px solid #e5e7eb}
    .total-row td:first-child{text-transform:uppercase;letter-spacing:.5px;font-size:11px;color:#6b7280;font-weight:700}
    .footer{text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
    .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;text-transform:capitalize;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <div class="header">
    <h1>${storeName}</h1>
    <p class="receipt-label">Official Receipt</p>
  </div>

  <div class="meta">
    <div class="meta-block">
      <p class="label">Order #</p>
      <p class="value">${orderNum}</p>
    </div>
    <div class="meta-block">
      <p class="label">Date</p>
      <p class="value">${new Date(order.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
    <div class="meta-block">
      <p class="label">Customer</p>
      <p class="value">${order.buyer_ref || "Guest Buyer"}</p>
    </div>
    <div class="meta-block">
      <p class="label">Status</p>
      <span class="badge">${order.status.replace(/_/g, " ")}</span>
    </div>
  </div>

  ${order.notes ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:#92400e"><strong>Notes:</strong> ${order.notes}</div>` : ""}

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3">Total Amount</td>
        <td style="text-align:right">${formatCurrency(order.total ?? 0)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <p>Thank you for your order!</p>
    <p style="margin-top:4px">Channel: <strong style="text-transform:capitalize">${order.channel}</strong></p>
  </div>
  <script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=700,height=900");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatCurrency(n: number | null) {
    if (n == null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(n);
  }

  onMount(() => {
    if (activeStore.slug) {
      load();
      loadNotes();
      loadFiles();
    }
  });

  const currentStepIndex = $derived(
    STATUS_STEPS.findIndex((s: any) => s.id === order?.status),
  );
  const nextStep = $derived.by(() => {
    if (!order) return null;
    const s = order.status;
    const isPickup = (order as any).delivery_type === "pickup";

    if (s === "pending_payment") return { id: "paid", label: "Payment" };
    if (s === "pending" || s === "paid")
      return { id: "picking", label: "Picking" };
    if (s === "picking") return { id: "packing", label: "Packing" };
    if (s === "packing") {
      return isPickup
        ? { id: "ready_for_pickup", label: "Ready for Pickup" }
        : { id: "in_transit", label: "In Transit" };
    }
    if (s === "ready_for_pickup")
      return { id: "picked_up", label: "Picked Up" };
    if (s === "in_transit") return { id: "delivered", label: "Delivered" };

    return null;
  });
</script>

<svelte:head>
  <title>Order #{String(id).padStart(6, "0")} — Prompt Commerce</title>
</svelte:head>

<div class="p-6 max-w-6xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-center gap-6 mb-10">
    <div class="flex items-center gap-4">
      <Button
        onclick={() => goto("/admin/orders")}
        variant="secondary"
        size="sm"
        class="rounded-full w-10 h-10 p-0 border-none bg-gray-100 hover:bg-gray-200"
      >
        <ChevronLeft size={20} />
      </Button>
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-3xl font-black text-gray-900 tracking-tight">
            Order #{String(id).padStart(6, "0")}
          </h1>
          {#if order}
            <Badge variant="secondary" class="font-bold {STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}">
              {order.status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
            </Badge>
            <Badge class="border-none font-bold text-[10px] gap-1.5 {(order as any).delivery_type === 'pickup' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}">
              {#if (order as any).delivery_type === "pickup"}
                <Store size={10} /> Store Pickup
              {:else}
                <Truck size={10} /> Home Delivery
              {/if}
            </Badge>
          {/if}
        </div>
        {#if order}
          <p class="text-sm text-gray-400 font-medium mt-1">
            Placed on {formatDate(order.created_at)} via {order.channel}
          </p>
        {/if}
      </div>
    </div>

    <div class="md:ml-auto flex items-center gap-3">
      {#if order && order.status !== "cancelled" && order.status !== "delivered" && order.status !== "picked_up" && order.status !== "refunded"}
        <Button
          onclick={() => updateStatus("cancelled")}
          variant="secondary"
          class="text-red-500 hover:text-red-700 hover:bg-red-50 border-none"
        >
          Cancel Order
        </Button>
      {/if}
      {#if nextStep}
        <Button
          onclick={() => updateStatus(nextStep.id)}
          disabled={updating}
          variant="primary"
          size="lg"
          class="min-w-45"
        >
          {#if updating}
            <RefreshCw size={18} class="animate-spin mr-2" />
          {/if}
          Mark as {nextStep.label}
          <ArrowRight size={18} class="ml-1" />
        </Button>
      {/if}
    </div>
  </div>

  <!-- Modals -->
  {#if showingTrackingForm}
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onclick={(e) => e.target === e.currentTarget && (showingTrackingForm = false)}
      role="presentation"
    >
      <Card class="w-full max-w-sm shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-200">
        <div class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h3 class="text-xl font-black text-gray-900 leading-none">Shipping Details</h3>
            <p class="text-xs text-gray-400 font-medium mt-2">Enter carrier information for the buyer.</p>
          </div>
          <Button onclick={() => (showingTrackingForm = false)} variant="secondary" size="sm" class="p-1 border-none bg-transparent h-auto">
            <X size={20} />
          </Button>
        </div>

        <div class="p-6 space-y-6">
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

        <div class="p-6 flex gap-3 border-t border-gray-100 bg-gray-50/50">
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
        </div>
      </Card>
    </div>
  {/if}

  {#if showingCancelForm}
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onclick={(e) => e.target === e.currentTarget && (showingCancelForm = false)}
      role="presentation"
    >
      <Card class="w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
        <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <X size={32} />
        </div>
        <h3 class="text-xl font-black text-gray-900 leading-tight mb-2">Cancel Order?</h3>
        <p class="text-sm text-gray-400 font-medium mb-6">
          This will notify the customer and stop all processing. This action cannot be undone.
        </p>

        <div class="text-left mb-8">
          <label for="reason" class="block text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Reason for Cancellation</label>
          <textarea
            id="reason"
            bind:value={editCancelReason}
            placeholder="e.g. Out of stock, customer requested refund..."
            rows="3"
            class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none transition-all resize-none font-medium"
          ></textarea>
        </div>

        <div class="flex gap-3">
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
            class="flex-1 bg-red-600 hover:bg-red-700 font-black"
          >
            {#if savingCancel}
              <RefreshCw size={16} class="animate-spin mr-2" />
            {/if}
            Cancel Order
          </Button>
        </div>
      </Card>
    </div>
  {/if}

  {#if loading}
    <div class="py-24 flex flex-col items-center gap-4 text-center">
      <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-gray-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Syncing order status...</p>
    </div>
  {:else if order}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left Column: Details & Items -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Status Stepper -->
        <Card class="p-8">
          <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-10">
            Order Lifecycle
          </h2>
          <div class="relative">
            <div class="absolute top-5 left-0 w-full h-0.5 bg-gray-100">
              <div
                class="h-full bg-indigo-600 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(79,70,229,0.4)]"
                style="width: {currentStepIndex >= 0 ? (currentStepIndex / (STATUS_STEPS.length - 1)) * 100 : 0}%"
              ></div>
            </div>
            <div class="relative flex justify-between">
              {#each STATUS_STEPS as step, i}
                <div class="flex flex-col items-center">
                  <div
                    class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 z-10
                    {i <= currentStepIndex
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                      : 'bg-white border-gray-100 text-gray-300'}"
                  >
                    {#if i < currentStepIndex}
                      <CircleCheck size={18} />
                    {:else if i === currentStepIndex}
                      <Clock size={18} class="animate-pulse" />
                    {:else}
                      <div class="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                    {/if}
                  </div>
                  <p class="mt-4 text-[9px] font-black uppercase tracking-widest {i <= currentStepIndex ? 'text-indigo-600' : 'text-gray-400'}">
                    {step.label}
                  </p>
                </div>
              {/each}
            </div>
          </div>
          <!-- Cancelled/Refunded alert -->
          {#if order.status === "cancelled" || order.status === "refunded"}
            <div class="mt-10 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
              <X size={18} class="text-red-500" />
              <div class="text-[10px] font-black uppercase tracking-widest text-red-600">
                Order is {order.status}
              </div>
            </div>
          {/if}
        </Card>

        <!-- Items Table -->
        <Card class="overflow-hidden p-0">
          <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
              Cart Items
            </h2>
            <Badge variant="secondary" class="font-bold border-none bg-indigo-50 text-indigo-600">
              {order?.items?.length || 0} Items
            </Badge>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <tbody class="divide-y divide-gray-100">
                {#each order.items as item}
                  <tr class="group hover:bg-gray-50/50 transition-colors">
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 shrink-0 overflow-hidden shadow-sm">
                          {#if item.product_images?.[0]}
                            <img src={item.product_images[0]} alt={item.title} class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          {:else}
                            <div class="w-full h-full flex items-center justify-center text-gray-300">
                              <Package size={20} class="opacity-30" />
                            </div>
                          {/if}
                        </div>
                        <div>
                          <p class="font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {item.title}
                          </p>
                          <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">
                             {formatCurrency(item.price)} per unit
                          </p>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <div class="flex flex-col items-center">
                        <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Quantity</span>
                        <span class="font-black text-lg text-gray-900">{item.quantity}</span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-right">
                      <div class="flex flex-col items-end">
                        <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Subtotal</span>
                        <span class="font-black text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="bg-indigo-50/20">
                <tr class="border-t border-gray-100">
                  <td colspan="2" class="px-6 py-6 text-right">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Grand Total Amount</span>
                  </td>
                  <td class="px-6 py-6 text-right">
                    <span class="text-2xl font-black text-indigo-600 tracking-tight leading-none">
                      {formatCurrency(order.total)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <!-- Delivery Instructions -->
        <Card class="p-0 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
              Buyer Notes
            </h2>
            {#if !editingNotes}
              <Button onclick={startEditNotes} variant="secondary" size="sm" class="h-8 border-none bg-transparent group">
                <Pencil size={14} class="mr-1.5 text-indigo-600" />
                Edit
              </Button>
            {/if}
          </div>
          <div class="p-6">
            {#if editingNotes}
              <textarea
                bind:value={editNotesVal}
                rows="3"
                placeholder="Add special delivery instructions or buyer remarks…"
                class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all resize-none font-medium"
              ></textarea>
              <div class="flex justify-end gap-3 mt-4">
                <Button onclick={() => (editingNotes = false)} variant="secondary" size="sm">
                  Cancel
                </Button>
                <Button onclick={saveNotes} disabled={savingNotes} variant="primary" size="sm">
                  {#if savingNotes}
                    <RefreshCw size={14} class="animate-spin mr-1" />
                  {/if}
                  Save Notes
                </Button>
              </div>
            {:else if order.notes}
              <div class="flex gap-3">
                <FileText size={18} class="text-gray-300 shrink-0 mt-0.5" />
                <p class="text-sm text-gray-700 font-medium leading-relaxed italic">
                  "{order.notes}"
                </p>
              </div>
            {:else}
              <div class="flex flex-col items-center py-4 text-gray-400">
                <FileText size={24} class="opacity-20 mb-2" />
                <p class="text-[10px] font-black uppercase tracking-widest">No instructions provided</p>
              </div>
            {/if}
          </div>
        </Card>

        <!-- Internal Timeline -->
        <Card class="p-0 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
              Internal Timeline
            </h2>
            <label class="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                bind:checked={showDeletedNotes}
                onchange={loadNotes}
                class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
              />
              <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">Show Deleted</span>
            </label>
          </div>
          <div class="p-6">
            <div class="space-y-8 relative before:absolute before:left-3.75 before:top-2 before:bottom-2 before:w-px before:bg-gray-100">
              {#if loadingNotes && orderNotes.length === 0}
                <div class="flex items-center gap-4 py-2">
                  <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center animate-spin">
                    <RefreshCw size={14} class="text-gray-300" />
                  </div>
                  <p class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Loading history…</p>
                </div>
              {:else if orderNotes.length === 0}
                <div class="flex flex-col items-center py-8 text-gray-400">
                  <FileText size={28} class="opacity-20 mb-3" />
                  <p class="text-[10px] font-black uppercase tracking-widest">No notes in the timeline</p>
                </div>
              {:else}
                {#each orderNotes as note}
                  <div class="relative flex gap-6 group {note.deleted_at ? 'opacity-40 grayscale' : ''}">
                    <div class="shrink-0 w-8 h-8 rounded-full border-2 border-white bg-indigo-600 text-white flex items-center justify-center font-black text-[10px] shadow-sm z-10">
                      {note.created_by[0].toUpperCase()}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-4 mb-1">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-black text-gray-900 truncate">{note.created_by}</span>
                          <span class="text-[9px] font-bold text-gray-300 uppercase tracking-tight">{formatDate(note.created_at)}</span>
                        </div>
                        {#if !note.deleted_at}
                          <button onclick={() => deleteNote(note.id)} class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-50 rounded-lg">
                            <Trash2 size={12} />
                          </button>
                        {/if}
                      </div>
                      <p class="text-sm text-gray-600 font-medium leading-relaxed {note.deleted_at ? 'line-through decoration-2' : ''}">
                        {note.note}
                      </p>
                      {#if note.deleted_at}
                        <p class="mt-2 text-[8px] font-black uppercase tracking-[0.2em] text-red-400">
                          DELETED BY {note.deleted_by || 'Admin'} AT {formatDate(note.deleted_at)}
                        </p>
                      {/if}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>

            <!-- New Note Box -->
            <div class="mt-10 pt-8 border-t border-gray-100">
              <textarea
                bind:value={newNoteText}
                rows="2"
                placeholder="Share an internal update or remark…"
                class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all resize-none font-medium mb-3"
              ></textarea>
              <div class="flex justify-end">
                <Button onclick={addNote} disabled={addingNote || !newNoteText.trim()} variant="primary" size="sm" class="px-6">
                  {#if addingNote}
                    <RefreshCw size={14} class="animate-spin mr-1.5" />
                  {/if}
                  Share Note
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <!-- Order Files / Attachments -->
        <Card class="p-0 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
              File Attachments
            </h2>
            <label class="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                bind:checked={showDeletedFiles}
                onchange={loadFiles}
                class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
              />
              <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">Show Deleted</span>
            </label>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {#each orderFiles as file}
                <div
                  class="relative group p-4 border border-gray-100 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/40 transition-all shadow-sm flex flex-col {file.deleted_at ? 'opacity-40' : ''}"
                >
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                      {#if file.mime_type.startsWith("image/")}
                        <ImageIcon size={20} />
                      {:else}
                        <Paperclip size={20} />
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-black text-gray-900 truncate group-hover:text-indigo-600 transition-colors {file.deleted_at ? 'line-through' : ''}" title={file.original_name}>
                        {file.original_name}
                      </p>
                      <p class="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                        {(file.size_bytes / 1024).toFixed(1)} KB • {file.uploaded_by}
                      </p>
                      <div class="flex items-center gap-4 mt-3">
                        <a
                          href={file.file_url}
                          target="_blank"
                          class="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800"
                        >
                          <Download size={12} />
                          Get File
                        </a>
                        {#if !file.deleted_at}
                          <button
                            onclick={() => deleteFile(file.id)}
                            class="inline-flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-700"
                          >
                            <Trash2 size={12} />
                            Remove
                          </button>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}

              <label class="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/20 cursor-pointer transition-all group min-h-30">
                {#if uploadingFile}
                  <RefreshCw size={24} class="text-indigo-600 animate-spin" />
                  <span class="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Uploading…</span>
                {:else}
                  <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                    <Plus size={24} />
                  </div>
                  <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600 transition-all">Upload Document</span>
                {/if}
                <input type="file" class="hidden" onchange={uploadFile} disabled={uploadingFile} />
              </label>
            </div>
            <div class="mt-6 flex items-center justify-center gap-2 p-3 bg-gray-50 rounded-xl">
              <Clock size={14} class="text-gray-400" />
              <p class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">MAX SIZE 20MB • PDF, XLSX, IMAGES</p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Right Column: Buyer & Meta -->
      <div class="space-y-8">
        <!-- Buyer Card -->
        <Card class="p-0 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
              Buyer Profile
            </h2>
            {#if !editingBuyer}
              <Button onclick={startEditBuyer} variant="secondary" size="sm" class="h-8 border-none bg-transparent group">
                <Pencil size={14} class="mr-1.5 text-indigo-600" />
                Edit
              </Button>
            {/if}
          </div>
          <div class="p-6">
            {#if editingBuyer}
              <div class="space-y-6">
                <Input id="edit-buyer-name" label="Customer Name" bind:value={editBuyerName} placeholder="e.g. John Dela Cruz" />
                <Input id="edit-buyer-email" label="Email Address" type="email" bind:value={editBuyerEmail} placeholder="e.g. john@example.com" />
                <Input id="edit-buyer-ref" label="Platform Ref / ID" bind:value={editBuyerRef} placeholder="e.g. TG-123456" />
                <div class="space-y-1.5">
                  <label for="edit-channel" class="text-[11px] font-black uppercase tracking-widest text-gray-400 px-1">Source Channel</label>
                  <Select
                    id="edit-channel"
                    bind:value={editChannel}
                    options={CHANNELS}
                  />
                </div>
                <div class="flex gap-3 pt-2">
                  <Button onclick={() => (editingBuyer = false)} variant="secondary" class="flex-1">
                    Cancel
                  </Button>
                  <Button onclick={saveBuyer} disabled={savingBuyer} variant="primary" class="flex-1">
                    {#if savingBuyer}
                      <RefreshCw size={14} class="animate-spin" />
                    {/if}
                    Apply Changes
                  </Button>
                </div>
              </div>
            {:else}
              <div class="flex items-center gap-4 mb-6">
                <div class="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100">
                  {((order as any).buyer_name || order.buyer_ref || "G")[0].toUpperCase()}
                </div>
                <div class="min-w-0">
                  <p class="font-black text-lg text-gray-900 truncate">
                    {(order as any).buyer_name || "Guest Buyer"}
                  </p>
                  {#if (order as any).buyer_email}
                    <p class="text-xs text-gray-400 font-bold mt-0.5 truncate uppercase tracking-tight">{ (order as any).buyer_email }</p>
                  {/if}
                </div>
              </div>

              <div class="flex flex-wrap gap-2 mb-8">
                <Badge class="bg-gray-100 text-gray-500 border-none font-bold text-[9px]">
                  {order.channel.toUpperCase()}
                </Badge>
                {#if order.buyer_ref}
                  <Badge class="bg-indigo-50 text-indigo-600 border-none font-bold text-[9px] font-mono">
                    ID: {order.buyer_ref}
                  </Badge>
                {/if}
              </div>

              <!-- Delivery Detail Box -->
              <div class="pt-6 border-t border-gray-100">
                <div class="flex items-center justify-between mb-3">
                  <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Handover</p>
                  {#if !editingDelivery}
                    <Button onclick={startEditDelivery} variant="secondary" size="sm" class="p-1 h-auto border-none bg-transparent text-indigo-600">
                      <Pencil size={12} />
                    </Button>
                  {/if}
                </div>

                {#if editingDelivery}
                  <!-- Inline delivery edit -->
                  <div class="space-y-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 animate-in slide-in-from-top-2">
                    <Select
                      id="delivery-type"
                      bind:value={editDeliveryType}
                      options={[
                        { value: 'delivery', label: 'Home Delivery' },
                        { value: 'pickup', label: 'Store Pickup' }
                      ]}
                    />
                    <textarea
                      id="delivery-address"
                      bind:value={editDeliveryAddress}
                      placeholder="Street, City, Province, ZIP Code..."
                      rows="3"
                      class="w-full rounded-2xl border border-gray-100 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all resize-none font-medium"
                    ></textarea>
                    <div class="flex gap-2">
                      <Button onclick={() => (editingDelivery = false)} variant="secondary" size="sm" class="flex-1 bg-white">
                        Cancel
                      </Button>
                      <Button onclick={saveDelivery} disabled={savingDelivery} variant="primary" size="sm" class="flex-1">
                        {#if savingDelivery}
                          <RefreshCw size={12} class="animate-spin" />
                        {/if}
                        Save
                      </Button>
                    </div>
                  </div>
                {:else}
                  <div class="space-y-2">
                    <p class="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      {#if (order as any).delivery_type === "pickup"}
                        <Store size={16} class="text-indigo-600" /> Store Pickup
                      {:else}
                        <Truck size={16} class="text-indigo-600" /> Home Delivery
                      {/if}
                    </p>
                    {#if (order as any).delivery_address}
                      <p class="text-[11px] text-gray-500 leading-relaxed font-bold italic">
                        "{(order as any).delivery_address}"
                      </p>
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Tracking/Payment Section -->
              <div class="mt-6 pt-6 border-t border-gray-100 space-y-6">
                <!-- Tracking -->
                {#if (order as any).tracking_number}
                  <div class="p-4 bg-sky-50/50 rounded-2xl border border-sky-100 flex gap-3">
                    <Truck size={20} class="text-sky-600 shrink-0" />
                    <div>
                      <p class="text-[10px] font-black text-sky-400 uppercase tracking-widest leading-none mb-1.5 focus:outline-none">Live Tracking Info</p>
                      <p class="text-sm font-black text-sky-900 leading-none">
                        {(order as any).courier_name || 'Carrier'}: {(order as any).tracking_number}
                      </p>
                      {#if (order as any).tracking_url}
                        <a href={(order as any).tracking_url} target="_blank" class="inline-flex items-center gap-1.5 text-[10px] font-black text-sky-600 uppercase tracking-widest hover:underline mt-2">
                          <LinkIcon size={12} />
                          Trace Package
                        </a>
                      {/if}
                    </div>
                  </div>
                {/if}

                <!-- Payment Method -->
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest focus:outline-none">Payment Provider</p>
                    {#if !editingPayment}
                      <Button onclick={startEditPayment} variant="secondary" size="sm" class="p-1 h-auto border-none bg-transparent text-indigo-600">
                        <Pencil size={12} />
                      </Button>
                    {/if}
                  </div>
                  {#if editingPayment}
                    <div class="space-y-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 animate-in slide-in-from-top-2">
                      <Select
                        bind:value={editPaymentProvider}
                        options={[
                          { value: 'cod', label: 'Cash on Delivery' },
                          { value: 'mock', label: 'Mock / Test' },
                          { value: 'assisted', label: 'Assisted / Manual' },
                          { value: 'paymongo', label: 'PayMongo' },
                          { value: 'stripe', label: 'Stripe' }
                        ]}
                      />
                      <div class="flex gap-2">
                        <Button onclick={() => (editingPayment = false)} variant="secondary" size="sm" class="flex-1 bg-white">
                          Cancel
                        </Button>
                        <Button onclick={savePayment} disabled={savingPayment} variant="primary" size="sm" class="flex-1">
                          {#if savingPayment}
                            <RefreshCw size={12} class="animate-spin" />
                          {/if}
                          Update
                        </Button>
                      </div>
                    </div>
                  {:else}
                    <div class="flex items-center gap-2">
                      <CreditCard size={18} class="text-gray-300" />
                      <p class="text-xs font-black text-gray-900 uppercase tracking-wide">
                        {(order as any).payment_provider || "NONE"}
                      </p>
                    </div>
                    {#if (order as any).payment_instructions}
                      <p class="text-[10px] text-gray-500 mt-2 font-bold italic bg-gray-50 p-2 rounded-lg border border-gray-100">
                         "{(order as any).payment_instructions}"
                      </p>
                    {/if}
                  {/if}
                </div>
              </div>

              {#if (order as any).cancellation_reason}
                <div class="mt-6 p-4 bg-red-50/50 rounded-2xl border border-red-100 gap-3 flex flex-col">
                  <div class="flex items-center gap-2">
                    <X size={16} class="text-red-500" />
                    <p class="text-[10px] font-black text-red-400 uppercase tracking-widest text-center">Order was Cancelled</p>
                  </div>
                  <p class="text-xs font-bold text-red-900 leading-relaxed bg-white/50 p-3 rounded-xl">
                    "{(order as any).cancellation_reason}"
                  </p>
                </div>
              {/if}
            {/if}
          </div>
        </Card>

        <!-- Delivery Location Card -->
        <Card class="p-0 overflow-hidden text-center justify-items-center">
          <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between focus:outline-none">
            <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
              Geospatial Pin
            </h2>
            {#if !editingLocation}
              <Button onclick={startEditLocation} variant="secondary" size="sm" class="h-8 border-none bg-transparent group">
                <MapPin size={14} class="mr-1.5 text-indigo-600" />
                {order.lat && order.lng ? 'Remap' : 'Add Map'}
              </Button>
            {/if}
          </div>
          <div class="p-6">
            {#if editingLocation}
              <div class="space-y-6">
                <div class="grid grid-cols-2 gap-4">
                  <Input id="edit-lat" label="Latitude" type="number" bind:value={editLat} placeholder="e.g. 14.5995" />
                  <Input id="edit-lng" label="Longitude" type="number" bind:value={editLng} placeholder="e.g. 120.9842" />
                </div>
                <div class="flex gap-3">
                  <Button onclick={() => (editingLocation = false)} variant="secondary" class="flex-1">
                    Cancel
                  </Button>
                  <Button onclick={saveLocation} disabled={savingLocation} variant="primary" class="flex-1">
                    {#if savingLocation}
                      <RefreshCw size={14} class="animate-spin mr-1.5" />
                    {/if}
                    Save Pin
                  </Button>
                </div>
              </div>
            {:else if order.lat && order.lng}
              <div class="space-y-6">
                <div class="aspect-video w-full rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 relative group shadow-sm">
                  <iframe
                    title="Order Location"
                    width="100%"
                    height="100%"
                    frameborder="0"
                    style="border:0"
                    src="https://www.google.com/maps/embed/v1/place?key={data.googlePlacesApiKey}&q={order.lat},{order.lng}&zoom=15"
                    allowfullscreen
                    class="group-hover:opacity-90 transition-opacity"
                  ></iframe>
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div class="px-3 py-1.5 bg-gray-100 rounded-lg">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">GPS Coordinates</span>
                    <code class="text-[11px] font-mono font-bold text-gray-700">{order.lat.toFixed(6)}, {order.lng.toFixed(6)}</code>
                  </div>
                  <Button
                    variant="secondary"
                    onclick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${order?.lat},${order?.lng}`, '_blank')}
                    class="font-black text-[10px] tracking-widest uppercase border-gray-200"
                  >
                    Open Google Maps
                    <LinkIcon size={14} class="ml-2" />
                  </Button>
                </div>
              </div>
            {:else}
              <div class="py-12 flex flex-col items-center justify-center text-center">
                <div class="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-200 mb-6 group">
                   <MapPin size={28} class="group-hover:text-indigo-600 transition-colors" />
                </div>
                <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight mb-2">No GPS Pin Added</h3>
                <p class="text-xs font-medium text-gray-400 mb-6 max-w-50">Coordinates help delivery riders find the customer faster.</p>
                <Button onclick={startEditLocation} variant="primary" size="sm" class="px-8 border-none bg-indigo-600 font-black">
                  Set Coords
                </Button>
              </div>
            {/if}
          </div>
        </Card>

        <!-- Timestamps -->
        <Card class="p-6 space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Order Created</span>
            <span class="text-xs font-black text-gray-900">{formatDate(order.created_at)}</span>
          </div>
          <div class="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Last Synced</span>
            <span class="text-xs font-black text-gray-900">{formatDate(order.updated_at)}</span>
          </div>
        </Card>

        <!-- Print Actions -->
        <div class="flex flex-col gap-3">
          <Button onclick={printPackingSlip} variant="primary" size="lg" class="bg-gray-900 hover:bg-black shadow-lg shadow-gray-200 py-6 uppercase font-black text-xs tracking-[0.2em]">
            <Printer size={16} class="mr-2" />
            Print Packing Slip
          </Button>
          <Button onclick={printReceipt} variant="secondary" size="lg" class="bg-white border-gray-200 py-6 uppercase font-black text-xs tracking-[0.2em]">
            <Download size={16} class="mr-2" />
            Export Receipt / PDF
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
