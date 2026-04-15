<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { goto } from "$app/navigation";
  import type { Order } from "$lib/types/orders.js";
  import Card from "$lib/components/ui/Card.svelte";
  import { 
    Download,
    Printer,
    Clock,
  } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";

  // New Components
  import OrderDetailHeader from "$lib/components/orders/OrderDetailHeader.svelte";
  import OrderStatusStepper from "$lib/components/orders/OrderStatusStepper.svelte";
  import OrderItemsTable from "$lib/components/orders/OrderItemsTable.svelte";
  import OrderBuyerProfile from "$lib/components/orders/OrderBuyerProfile.svelte";
  import OrderFulfillmentCard from "$lib/components/orders/OrderFulfillmentCard.svelte";
  import OrderTimeline from "$lib/components/orders/OrderTimeline.svelte";
  import OrderAttachments from "$lib/components/orders/OrderAttachments.svelte";
  import OrderLocationCard from "$lib/components/orders/OrderLocationCard.svelte";
  import OrderActionModals from "$lib/components/orders/OrderActionModals.svelte";

  import { STATUS_STEPS } from "$lib/constants/orders.js";
  import { formatDate, formatCurrency } from "$lib/utils/format.js";

  let { data } = $props();

  const id = $derived(parseInt(page.params.id));
  let order = $state<Order | null>(null);
  let loading = $state(true);
  let updating = $state(false);

  // Modal visibility
  let showingTrackingForm = $state(false);
  let showingCancelForm = $state(false);

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
      !(order as any).tracking_number
    ) {
      showingTrackingForm = true;
      return;
    }

    // Intercept cancellation reason
    if (status === "cancelled") {
      showingCancelForm = true;
      return;
    }

    updating = true;
    await patch({ status });
    updating = false;
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

  onMount(() => {
    if (activeStore.slug) {
      load();
    }
  });

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
  {#if loading}
    <div class="py-24 flex flex-col items-center gap-4 text-center">
      <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-gray-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Syncing order status...</p>
    </div>
  {:else if order}
    <!-- Header -->
    <OrderDetailHeader 
      {order} 
      {updating} 
      {nextStep} 
      onUpdateStatus={updateStatus} 
    />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left Column: Details & Items -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Status Stepper -->
        <OrderStatusStepper status={order.status} />

        <!-- Items Table -->
        <OrderItemsTable items={order.items} total={order.total} />

        <!-- Internal Timeline (includes Buyer Notes) -->
        <OrderTimeline 
          {order} 
          slug={activeStore.slug} 
          onSaveBuyerNotes={(notes) => patch({ notes })} 
        />

        <!-- Order Files / Attachments -->
        <OrderAttachments orderId={id} slug={activeStore.slug} />
      </div>

      <!-- Right Column: Buyer & Meta -->
      <div class="space-y-8">
        <!-- Buyer Card -->
        <OrderBuyerProfile {order} onSave={patch} />

        <!-- Delivery & Payment -->
        <OrderFulfillmentCard {order} onSave={patch} />

        <!-- Delivery Location Card -->
        <OrderLocationCard 
          {order} 
          googlePlacesApiKey={data.googlePlacesApiKey} 
          onSave={patch} 
        />

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

    <!-- Modals -->
    <OrderActionModals 
      {order}
      bind:showingTrackingForm
      bind:showingCancelForm
      onSaveTracking={patch}
      onSaveCancel={patch}
    />
  {/if}
</div>
