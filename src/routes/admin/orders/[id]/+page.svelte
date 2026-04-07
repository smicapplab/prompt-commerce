<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { goto } from "$app/navigation";
  import type { Order } from "$lib/types/orders.js";

  const id = $derived(parseInt(page.params.id));
  let order = $state<Order | null>(null);
  let loading = $state(true);
  let updating = $state(false);

  // ── Inline edit state ───────────────────────────────────────────
  let editingBuyer = $state(false);
  let editBuyerRef = $state("");
  let editChannel = $state("");
  let savingBuyer = $state(false);

  let editingDelivery = $state(false);
  let editDeliveryType = $state("");
  let savingDelivery = $state(false);

  let editingPayment = $state(false);
  let editPaymentProvider = $state("");
  let savingPayment = $state(false);

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

  const CHANNELS = [
    { value: "manual", label: "Manual Entry" },
    { value: "telegram", label: "Telegram" },
    { value: "facebook", label: "Facebook Messenger" },
    { value: "instagram", label: "Instagram" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "viber", label: "Viber" },
  ];

  const STATUS_STEPS = [
    {
      id: "pending_payment",
      label: "Payment",
      icon: "M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
    },
    {
      id: "pending",
      label: "Pending",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      id: "paid",
      label: "Paid",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      id: "picking",
      label: "Picking",
      icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    },
    {
      id: "packing",
      label: "Packing",
      icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
    },
    {
      id: "ready_for_pickup",
      label: "Ready",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    },
    {
      id: "in_transit",
      label: "In Transit",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    { id: "delivered", label: "Delivered", icon: "M5 13l4 4L19 7" },
  ];

  const STATUS_COLORS: Record<string, string> = {
    pending_payment: "text-orange-600 bg-orange-50 border-orange-200",
    pending: "text-amber-600 bg-amber-50 border-amber-200",
    paid: "text-blue-600 bg-blue-50 border-blue-200",
    picking: "text-indigo-600 bg-indigo-50 border-indigo-200",
    packing: "text-violet-600 bg-violet-50 border-violet-200",
    ready_for_pickup: "text-cyan-600 bg-cyan-50 border-cyan-200",
    picked_up: "text-emerald-600 bg-emerald-50 border-emerald-200",
    in_transit: "text-sky-600 bg-sky-50 border-sky-200",
    delivered: "text-emerald-600 bg-emerald-50 border-emerald-200",
    cancelled: "text-red-600 bg-red-50 border-red-200",
    refunded: "text-gray-600 bg-gray-50 border-gray-200",
  };

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
    editChannel = order?.channel ?? "manual";
    editingBuyer = true;
  }

  async function saveBuyer() {
    savingBuyer = true;
    const ok = await patch({
      buyer_ref: editBuyerRef || null,
      channel: editChannel,
    });
    savingBuyer = false;
    if (ok) editingBuyer = false;
  }

  function startEditDelivery() {
    editDeliveryType = (order as any)?.delivery_type ?? "delivery";
    editingDelivery = true;
  }

  async function saveDelivery() {
    savingDelivery = true;
    const ok = await patch({ delivery_type: editDeliveryType });
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
        <th>✓</th>
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
    STATUS_STEPS.findIndex((s) => s.id === order?.status),
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

<svelte:head
  ><title>Order #{String(id).padStart(6, "0")} — Prompt Commerce</title
  ></svelte:head
>

<div class="p-6 max-w-5xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex items-center gap-4 mb-8">
    <button
      onclick={() => goto("/admin/orders")}
      class="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
      aria-label="Back to orders list"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        /></svg
      >
    </button>
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-gray-900">
          Order #{String(id).padStart(6, "0")}
        </h1>
        {#if order}
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border {STATUS_COLORS[
              order.status
            ] ?? 'bg-gray-100 text-gray-600 border-gray-200'}"
          >
            {order.status
              .split("_")
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ")}
          </span>
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border {(
              order as any
            ).delivery_type === 'pickup'
              ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
              : 'bg-emerald-50 text-emerald-600 border-emerald-200'}"
          >
            {(order as any).delivery_type === "pickup"
              ? "🏪 Pickup"
              : "🚚 Delivery"}
          </span>
        {/if}
      </div>
      {#if order}
        <p class="text-sm text-gray-500 mt-1">
          Placed on {formatDate(order.created_at)}
        </p>
      {/if}
    </div>

    <div class="ml-auto flex items-center gap-3">
      {#if order && order.status !== "cancelled" && order.status !== "delivered" && order.status !== "picked_up" && order.status !== "refunded"}
        <button
          onclick={() => updateStatus("cancelled")}
          class="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
        >
          Cancel Order
        </button>
      {/if}
      {#if nextStep}
        <button
          onclick={() => updateStatus(nextStep.id)}
          disabled={updating}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all active:scale-95 disabled:opacity-50"
        >
          {#if updating}
            <div
              class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></div>
          {/if}
          Mark as {nextStep.label}
        </button>
      {/if}
    </div>
  </div>

  <!-- Modals -->
  {#if showingTrackingForm}
    <div
      class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        <div class="p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-1">
            Add Tracking Information
          </h3>
          <p class="text-sm text-gray-500 mb-6">
            Enter tracking details for this delivery.
          </p>

          <div class="space-y-4">
            <div>
              <label
                for="courier"
                class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"
                >Courier Name</label
              >
              <input
                id="courier"
                bind:value={editCourierName}
                placeholder="e.g. Lalamove, Grab, J&T"
                class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
              />
            </div>
            <div>
              <label
                for="tracking"
                class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"
                >Tracking Number</label
              >
              <input
                id="tracking"
                bind:value={editTrackingNumber}
                placeholder="e.g. TRK-12345678"
                class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
              />
            </div>
            <div>
              <label
                for="url"
                class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"
                >Tracking URL (Optional)</label
              >
              <input
                id="url"
                bind:value={editTrackingUrl}
                placeholder="https://..."
                class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
              />
            </div>
          </div>
        </div>
        <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            onclick={() => (showingTrackingForm = false)}
            class="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={saveTracking}
            disabled={savingTracking || !editCourierName || !editTrackingNumber}
            class="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {#if savingTracking}
              <div
                class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
              ></div>
            {/if}
            Save Tracking Info
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showingCancelForm}
    <div
      class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        <div class="p-6 text-center">
          <div
            class="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              /></svg
            >
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-1">Cancel Order</h3>
          <p class="text-sm text-gray-500 mb-6">
            Are you sure? This action cannot be undone.
          </p>

          <div class="text-left">
            <label
              for="reason"
              class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"
              >Cancellation Reason</label
            >
            <textarea
              id="reason"
              bind:value={editCancelReason}
              placeholder="e.g. Out of stock, Customer request..."
              rows="3"
              class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none transition-all resize-none"
            ></textarea>
          </div>
        </div>
        <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            onclick={() => (showingCancelForm = false)}
            class="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Go Back
          </button>
          <button
            onclick={saveCancel}
            disabled={savingCancel || !editCancelReason.trim()}
            class="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {#if savingCancel}
              <div
                class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
              ></div>
            {/if}
            Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="py-24 flex flex-col items-center gap-4">
      <div
        class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
      ></div>
      <p class="text-gray-400 font-medium animate-pulse">
        Fetching order details...
      </p>
    </div>
  {:else if order}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left Column: Details & Items -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Status Stepper -->
        <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2
            class="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider"
          >
            Order Progress
          </h2>
          <div class="relative">
            <div class="absolute top-5 left-0 w-full h-0.5 bg-gray-100">
              <div
                class="h-full bg-indigo-600 transition-all duration-500"
                style="width: {currentStepIndex >= 0
                  ? (currentStepIndex / (STATUS_STEPS.length - 1)) * 100
                  : 0}%"
              ></div>
            </div>
            <div class="relative flex justify-between">
              {#each STATUS_STEPS as step, i}
                <div class="flex flex-col items-center">
                  <div
                    class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10
                    {i <= currentStepIndex
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-gray-200 text-gray-300'}"
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d={step.icon}
                      /></svg
                    >
                  </div>
                  <p
                    class="mt-3 text-[10px] font-bold uppercase tracking-wide {i <=
                    currentStepIndex
                      ? 'text-indigo-600'
                      : 'text-gray-400'}"
                  >
                    {step.label}
                  </p>
                </div>
              {/each}
            </div>
          </div>
          <!-- Cancelled/Refunded badge outside stepper -->
          {#if order.status === "cancelled" || order.status === "refunded"}
            <div
              class="mt-6 flex items-center gap-2 text-sm font-bold {order.status ===
              'cancelled'
                ? 'text-red-600'
                : 'text-gray-500'}"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                /></svg
              >
              This order is {order.status === "cancelled"
                ? "Cancelled"
                : "Refunded"}
            </div>
          {/if}
        </div>

        <!-- Items Table -->
        <div
          class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center"
          >
            <h2
              class="text-sm font-bold text-gray-900 uppercase tracking-wider"
            >
              Order Items
            </h2>
            <span
              class="text-xs font-bold text-gray-400 bg-white px-2 py-1 rounded border border-gray-100"
              >{order.items.length} Items</span
            >
          </div>
          <table class="w-full text-left text-sm">
            <tbody class="divide-y divide-gray-100">
              {#each order.items as item}
                <tr class="group">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-4">
                      <div
                        class="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden"
                      >
                        {#if item.product_images?.[0]}
                          <img
                            src={item.product_images[0]}
                            alt={item.title}
                            class="w-full h-full object-cover"
                          />
                        {:else}
                          <div
                            class="w-full h-full flex items-center justify-center text-gray-300 text-[9px] font-bold"
                          >
                            NO IMG
                          </div>
                        {/if}
                      </div>
                      <div>
                        <p
                          class="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors"
                        >
                          {item.title}
                        </p>
                        <p class="text-xs text-gray-400 mt-0.5">
                          Unit price: {formatCurrency(item.price)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <span class="text-gray-400 text-xs font-bold uppercase mr-1"
                      >Qty:</span
                    >
                    <span class="font-bold text-gray-900">{item.quantity}</span>
                  </td>
                  <td class="px-6 py-4 text-right font-bold text-gray-900">
                    {formatCurrency(item.price * item.quantity)}
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot class="bg-gray-50/30">
              <tr class="border-t border-gray-200">
                <td
                  colspan="2"
                  class="px-6 py-4 text-sm font-medium text-gray-500 text-right uppercase tracking-wider"
                  >Grand Total</td
                >
                <td
                  class="px-6 py-4 text-right text-lg font-black text-indigo-600"
                  >{formatCurrency(order.total)}</td
                >
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- High-level Notes (existing) -->
        <div
          class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <svg
                class="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                /></svg
              >
              <h2
                class="text-sm font-bold text-gray-900 uppercase tracking-wider"
              >
                Delivery Instructions
              </h2>
            </div>
            {#if !editingNotes}
              <button
                onclick={startEditNotes}
                class="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1 rounded hover:bg-indigo-50"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  /></svg
                >
                Edit
              </button>
            {/if}
          </div>
          <div class="p-6">
            {#if editingNotes}
              <textarea
                bind:value={editNotesVal}
                rows="3"
                placeholder="Add delivery instructions, address, or internal notes…"
                class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all resize-none"
              ></textarea>
              <div class="flex justify-end gap-2 mt-3">
                <button
                  onclick={() => (editingNotes = false)}
                  class="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onclick={saveNotes}
                  disabled={savingNotes}
                  class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {#if savingNotes}
                    <div
                      class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                    ></div>
                  {/if}
                  Save Notes
                </button>
              </div>
            {:else if order.notes}
              <p class="text-sm text-gray-700 font-medium leading-relaxed">
                {order.notes}
              </p>
            {:else}
              <p class="text-sm text-gray-400 italic">
                No instructions yet. Click Edit to add remarks.
              </p>
            {/if}
          </div>
        </div>

        <!-- Collaborative Notes / Timeline -->
        <div
          class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between"
          >
            <h2
              class="text-sm font-bold text-gray-900 uppercase tracking-wider"
            >
              Internal Timeline
            </h2>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={showDeletedNotes}
                onchange={loadNotes}
                class="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span
                class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                >Show Deleted</span
              >
            </label>
          </div>
          <div class="p-6">
            <div class="space-y-6">
              {#if loadingNotes && orderNotes.length === 0}
                <div class="py-4 text-center text-xs text-gray-400">
                  Loading timeline…
                </div>
              {:else if orderNotes.length === 0}
                <div class="py-4 text-center text-xs text-gray-400 italic">
                  No internal notes yet.
                </div>
              {:else}
                {#each orderNotes as note}
                  <div
                    class="flex gap-4 group {note.deleted_at
                      ? 'opacity-50'
                      : ''}"
                  >
                    <div
                      class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500"
                    >
                      {note.created_by[0].toUpperCase()}
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-bold text-gray-900"
                            >{note.created_by}</span
                          >
                          <span class="text-[10px] text-gray-400"
                            >{formatDate(note.created_at)}</span
                          >
                        </div>
                        {#if !note.deleted_at}
                          <button
                            onclick={() => deleteNote(note.id)}
                            class="hidden group-hover:block text-red-500 hover:text-red-700"
                            aria-label="Delete note"
                          >
                            <svg
                              class="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              /></svg
                            >
                          </button>
                        {:else}
                          <span
                            class="text-[9px] font-black text-red-400 uppercase tracking-widest"
                            >Deleted by {note.deleted_by}</span
                          >
                        {/if}
                      </div>
                      <p
                        class="text-sm text-gray-600 leading-relaxed {note.deleted_at
                          ? 'line-through'
                          : ''}"
                      >
                        {note.note}
                      </p>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>

            <div class="mt-8 pt-6 border-t border-gray-100">
              <textarea
                bind:value={newNoteText}
                rows="2"
                placeholder="Add internal note or update…"
                class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all resize-none bg-gray-50"
              ></textarea>
              <div class="flex justify-end mt-2">
                <button
                  onclick={addNote}
                  disabled={addingNote || !newNoteText.trim()}
                  class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gray-900 text-white rounded-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                >
                  {#if addingNote}
                    <div
                      class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                    ></div>
                  {/if}
                  Add Timeline Entry
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Files / Attachments -->
        <div
          class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between"
          >
            <h2
              class="text-sm font-bold text-gray-900 uppercase tracking-wider"
            >
              Attachments
            </h2>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={showDeletedFiles}
                onchange={loadFiles}
                class="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span
                class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                >Show Deleted</span
              >
            </label>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {#each orderFiles as file}
                <div
                  class="relative group p-4 border border-gray-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all {file.deleted_at
                    ? 'opacity-50'
                    : ''}"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600"
                    >
                      {#if file.mime_type.startsWith("image/")}
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          /></svg
                        >
                      {:else}
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          /></svg
                        >
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-xs font-bold text-gray-900 truncate {file.deleted_at
                          ? 'line-through'
                          : ''}"
                        title={file.original_name}
                      >
                        {file.original_name}
                      </p>
                      <p class="text-[10px] text-gray-400 mt-0.5 uppercase">
                        {(file.size_bytes / 1024).toFixed(1)} KB • {file.uploaded_by}
                      </p>
                      <div class="flex items-center gap-3 mt-2">
                        <a
                          href={file.file_url}
                          target="_blank"
                          class="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                          >Download</a
                        >
                        {#if !file.deleted_at}
                          <button
                            onclick={() => deleteFile(file.id)}
                            class="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                            >Delete</button
                          >
                        {:else}
                          <span
                            class="text-[9px] font-black text-red-400 uppercase tracking-widest"
                            >Deleted</span
                          >
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}

              <label
                class="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:bg-gray-50 cursor-pointer transition-all"
              >
                {#if uploadingFile}
                  <div
                    class="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"
                  ></div>
                  <span
                    class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >Uploading…</span
                  >
                {:else}
                  <svg
                    class="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    /></svg
                  >
                  <span
                    class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >Attach File</span
                  >
                {/if}
                <input
                  type="file"
                  class="hidden"
                  onchange={uploadFile}
                  disabled={uploadingFile}
                />
              </label>
            </div>
            <p
              class="mt-4 text-[10px] text-gray-400 text-center uppercase tracking-widest"
            >
              PDF, Excel, Word, or Images up to 20MB
            </p>
          </div>
        </div>
      </div>

      <!-- Right Column: Buyer & Meta -->
      <div class="space-y-6">
        <!-- Buyer Card -->
        <div
          class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between"
          >
            <h2
              class="text-sm font-bold text-gray-900 uppercase tracking-wider"
            >
              Buyer Information
            </h2>
            {#if !editingBuyer}
              <button
                onclick={startEditBuyer}
                class="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1 rounded hover:bg-indigo-50"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  /></svg
                >
                Edit
              </button>
            {/if}
          </div>
          <div class="p-6">
            {#if editingBuyer}
              <div class="space-y-3">
                <div>
                  <label
                    for="edit-buyer-ref"
                    class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"
                    >Buyer Name / Ref</label
                  >
                  <input
                    id="edit-buyer-ref"
                    bind:value={editBuyerRef}
                    placeholder="e.g. John Dela Cruz"
                    class="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                  />
                </div>
                <div>
                  <label
                    for="edit-channel"
                    class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"
                    >Source Channel</label
                  >
                  <select
                    id="edit-channel"
                    bind:value={editChannel}
                    class="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                  >
                    {#each CHANNELS as ch}
                      <option value={ch.value}>{ch.label}</option>
                    {/each}
                  </select>
                </div>
                <div class="flex justify-end gap-2 pt-1">
                  <button
                    onclick={() => (editingBuyer = false)}
                    class="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onclick={saveBuyer}
                    disabled={savingBuyer}
                    class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
                  >
                    {#if savingBuyer}
                      <div
                        class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                      ></div>
                    {/if}
                    Save
                  </button>
                </div>
              </div>
            {:else}
              <div class="flex items-center gap-4 mb-5">
                <div
                  class="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg flex-shrink-0"
                >
                  {(order.buyer_ref ?? "G")[0].toUpperCase()}
                </div>
                <div>
                  <p class="font-bold text-gray-900">
                    {order.buyer_ref ?? "Guest Buyer"}
                  </p>
                  <div
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-600 mt-1"
                  >
                    {order.channel}
                  </div>
                </div>
              </div>

              <!-- Delivery Type Section -->
              <div class="mt-6 pt-4 border-t border-gray-50">
                <div class="flex items-center justify-between mb-2">
                  <p
                    class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                  >
                    Delivery Type
                  </p>
                  {#if !editingDelivery}
                    <button
                      onclick={startEditDelivery}
                      class="text-[10px] font-bold text-indigo-600 hover:underline"
                      >Edit</button
                    >
                  {/if}
                </div>
                {#if editingDelivery}
                  <div class="space-y-2">
                    <select
                      bind:value={editDeliveryType}
                      class="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                    >
                      <option value="delivery">🚚 Home Delivery</option>
                      <option value="pickup">🏪 Store Pickup</option>
                    </select>
                    <div class="flex justify-end gap-2">
                      <button
                        onclick={() => (editingDelivery = false)}
                        class="text-xs font-bold text-gray-500 px-2 py-1"
                        >Cancel</button
                      >
                      <button
                        onclick={saveDelivery}
                        disabled={savingDelivery}
                        class="text-xs font-bold text-indigo-600 px-2 py-1 disabled:opacity-50"
                      >
                        {savingDelivery ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                {:else}
                  <p class="text-sm font-semibold text-gray-900">
                    {(order as any).delivery_type === "pickup"
                      ? "🏪 Store Pickup"
                      : "🚚 Home Delivery"}
                  </p>
                {/if}
              </div>

              {#if (order as any).tracking_number}
                <div
                  class="mt-6 p-4 bg-sky-50 rounded-xl border border-sky-100"
                >
                  <p
                    class="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      /></svg
                    >
                    Tracking Information
                  </p>
                  <div class="space-y-1">
                    <p class="text-sm font-bold text-sky-900">
                      {(order as any).courier_name}: {(order as any)
                        .tracking_number}
                    </p>
                    {#if (order as any).tracking_url}
                      <a
                        href={(order as any).tracking_url}
                        target="_blank"
                        class="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1"
                      >
                        Track Package
                        <svg
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          /></svg
                        >
                      </a>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Payment Method Section -->
              <div class="mt-4 pt-4 border-t border-gray-50">
                <div class="flex items-center justify-between mb-2">
                  <p
                    class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                  >
                    Payment Method
                  </p>
                  {#if !editingPayment}
                    <button
                      onclick={startEditPayment}
                      class="text-[10px] font-bold text-indigo-600 hover:underline"
                      >Edit</button
                    >
                  {/if}
                </div>
                {#if editingPayment}
                  <div class="space-y-2">
                    <select
                      bind:value={editPaymentProvider}
                      class="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                    >
                      <option value="cod">💵 Cash on Delivery</option>
                      <option value="mock">🧪 Mock / Test</option>
                      <option value="assisted">🤝 Assisted / Manual</option>
                      <option value="paymongo">🇵🇭 PayMongo</option>
                      <option value="stripe">🌍 Stripe</option>
                    </select>
                    <div class="flex justify-end gap-2">
                      <button
                        onclick={() => (editingPayment = false)}
                        class="text-xs font-bold text-gray-500 px-2 py-1"
                        >Cancel</button
                      >
                      <button
                        onclick={savePayment}
                        disabled={savingPayment}
                        class="text-xs font-bold text-indigo-600 px-2 py-1 disabled:opacity-50"
                      >
                        {savingPayment ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                {:else}
                  <p class="text-sm font-semibold text-gray-900 uppercase">
                    {(order as any).payment_provider || "NONE"}
                  </p>
                  {#if (order as any).payment_instructions}
                    <p class="text-xs text-gray-500 mt-1 italic">
                      {(order as any).payment_instructions}
                    </p>
                  {/if}
                {/if}
              </div>

              {#if (order as any).cancellation_reason}
                <div
                  class="mt-6 p-4 bg-red-50 rounded-xl border border-red-100"
                >
                  <p
                    class="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1"
                  >
                    Cancellation Reason
                  </p>
                  <p class="text-sm font-medium text-red-900">
                    {(order as any).cancellation_reason}
                  </p>
                </div>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Meta Data -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div class="p-6 space-y-4">
            <div>
              <p
                class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"
              >
                Order Placed
              </p>
              <p class="text-sm font-semibold text-gray-900">
                {formatDate(order.created_at)}
              </p>
            </div>
            <div class="pt-4 border-t border-gray-100">
              <p
                class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1"
              >
                Last Updated
              </p>
              <p class="text-sm font-semibold text-gray-900">
                {formatDate(order.updated_at)}
              </p>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2">
          <button
            onclick={printPackingSlip}
            class="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              /></svg
            >
            Print Packing Slip
          </button>
          <button
            onclick={printReceipt}
            class="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-all active:scale-95"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              /></svg
            >
            Export Receipt / PDF
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
