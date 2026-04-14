<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import {
    Package,
    Tag,
    Gift,
    Star,
    ShoppingCart,
    MessageSquare,
    TrendingUp,
    Clock,
    ArrowUpRight,
  } from "@lucide/svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import type { Stats } from "$lib/types/dashboard.js";

  let stats = $state<Stats | null>(null);
  let loading = $state(true);
  let error = $state("");

  // UX-R2-12: Setup checklist
  let storeSettings = $state<any>(null);
  let setupLoading = $state(true);

  const token = () => localStorage.getItem("pc_token") ?? "";

  import { STATUS_CHART_COLORS } from "$lib/constants/orders.js";

  const STATUS_TEXT: Record<string, string> = {
    pending: "text-amber-700",
    paid: "text-blue-700",
    picking: "text-indigo-700",
    packing: "text-violet-700",
    ready_for_pickup: "text-cyan-700",
    in_transit: "text-sky-700",
    delivered: "text-emerald-700",
    cancelled: "text-red-700",
    refunded: "text-gray-600",
  };

  const STATUS_BG: Record<string, string> = {
    pending: "bg-amber-50 border-amber-100",
    paid: "bg-blue-50 border-blue-100",
    picking: "bg-indigo-50 border-indigo-100",
    packing: "bg-violet-50 border-violet-100",
    ready_for_pickup: "bg-cyan-50 border-cyan-100",
    in_transit: "bg-sky-50 border-sky-100",
    delivered: "bg-emerald-50 border-emerald-100",
    cancelled: "bg-red-50 border-red-100",
    refunded: "bg-gray-50 border-gray-100",
  };

  const countCards = [
    {
      label: "Products",
      key: "products",
      icon: Package,
      href: "/admin/products",
      color: "bg-blue-50   text-blue-600",
    },
    {
      label: "Categories",
      key: "categories",
      icon: Tag,
      href: "/admin/categories",
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Promotions",
      key: "promotions",
      icon: Gift,
      href: "/admin/promotions",
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Reviews",
      key: "reviews",
      icon: Star,
      href: "/admin/reviews",
      color: "bg-yellow-50 text-yellow-600",
    },
    {
      label: "Conversations",
      key: "conversations",
      icon: MessageSquare,
      href: "/admin/chat",
      color: "bg-pink-50   text-pink-600",
    },
  ];

  // ── Chart helpers ────────────────────────────────────────────────────────
  const CHART_H = 90;
  const CHART_W = 520;
  const BAR_COUNT = 14;
  const BAR_GAP = 4;
  const BAR_W = $derived(
    Math.floor((CHART_W - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT),
  );

  const chartMax = $derived(
    stats ? Math.max(...stats.revenueTrend.map((d) => d.revenue), 1) : 1,
  );

  function barHeight(v: number) {
    return Math.max(3, (v / chartMax) * CHART_H);
  }

  function barX(i: number) {
    return i * (BAR_W + BAR_GAP);
  }

  function barY(v: number) {
    return CHART_H - barHeight(v);
  }

  function dayLabel(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-PH", { weekday: "short" }).charAt(0);
  }

  function isToday(dateStr: string) {
    return dateStr === new Date().toISOString().slice(0, 10);
  }

  // ── Formatting ───────────────────────────────────────────────────────────
  function currency(n: number | null) {
    if (n == null) return "—";
    if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₱${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(n);
  }

  function fullCurrency(n: number | null) {
    if (n == null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(n);
  }

  function relativeDate(d: string) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  }

  function statusLabel(s: string) {
    return s
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  onMount(async () => {
    if (!browser) return;
    if (!activeStore.id) {
      goto("/admin");
      return;
    }
    loading = true;
    const res = await fetch(`/api/stores/${activeStore.id}/stats`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) stats = await res.json();
    else error = "Could not load dashboard data.";
    loading = false;

    // Load store settings for checklist
    setupLoading = true;
    try {
      const sres = await fetch(`/api/settings?store=${activeStore.slug}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (sres.ok) storeSettings = await sres.json();
    } catch (e) {
      console.error("Failed to load setup status", e);
    }
    setupLoading = false;
  });

  // Total active orders for status bar %
  const totalOrdersForBar = $derived(
    stats ? Object.values(stats.ordersByStatus).reduce((a, b) => a + b, 0) : 0,
  );
</script>

<svelte:head>
  <title>Dashboard — {activeStore.name || "Store"}</title>
</svelte:head>

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto space-y-8">
  <!-- Page header -->
  <div class="flex items-start justify-between">
    <div class="flex items-center gap-2">
      <h1 class="text-2xl font-black text-gray-900 tracking-tight">
        {activeStore.name || activeStore.slug}
      </h1>
      <Badge
        class="bg-gray-100 text-gray-600 border-gray-200 font-mono tracking-normal"
        >{activeStore.slug}</Badge
      >
    </div>
    <Button href="/admin/orders/new" variant="primary">
      <ShoppingCart class="w-4 h-4" />
      New Order
    </Button>
  </div>

  {#if loading}
    <!-- Skeleton -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {#each Array(4) as _}
        <Card class="p-5 animate-pulse h-28" />
      {/each}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card class="lg:col-span-2 animate-pulse h-52" />
      <Card class="animate-pulse h-52" />
    </div>
  {:else if error}
    <div
      class="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 font-medium"
    >
      {error}
    </div>
  {:else if stats}
    <!-- ── Setup Checklist ────────────────────────────────────────────────── -->
    {#if !setupLoading && storeSettings}
      {@const hasAiKey =
        storeSettings.claude_api_key_set ||
        storeSettings.gemini_api_key_set ||
        storeSettings.openai_api_key_set}
      {@const aiDone = hasAiKey && storeSettings.ai_enabled === "1"}
      {@const hasMessaging =
        (storeSettings.telegram_bot_token_set &&
          storeSettings.telegram_enabled === "1") ||
        (!!storeSettings.whatsapp_notify_number &&
          storeSettings.whatsapp_enabled === "1")}
      {@const hasPayment =
        storeSettings.payment_api_key_set ||
        (storeSettings.payment_methods &&
          (() => {
            try {
              return JSON.parse(storeSettings.payment_methods).length > 0;
            } catch {
              return false;
            }
          })())}
      {@const steps = [
        {
          id: "products",
          label: "Add Products",
          done: stats.products > 0,
          href: "/admin/products",
        },
        {
          id: "ai",
          label: "Configure AI",
          done: !!aiDone,
          href: "/admin/settings?tab=ai",
        },
        {
          id: "messaging",
          label: "Messaging Setup",
          done: !!hasMessaging,
          href: "/admin/settings?tab=telegram",
        },
        {
          id: "payments",
          label: "Enable Payments",
          done: !!hasPayment,
          href: "/admin/settings?tab=payments",
        },
      ]}
      {#if steps.some((s) => !s.done)}
        <Card class="bg-indigo-50/50 border-indigo-100 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2
              class="text-sm font-bold text-indigo-900 uppercase tracking-wider"
            >
              Getting Started
            </h2>
            <Badge
              class="text-xs font-medium text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-100 italic"
            >
              {steps.filter((s) => s.done).length} of {steps.length} steps complete
            </Badge>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            {#each steps as step}
              <a
                href={step.href}
                class="flex items-center gap-3 p-3 rounded-xl bg-white border {step.done
                  ? 'border-indigo-200/50 opacity-60'
                  : 'border-indigo-200 shadow-sm hover:border-indigo-400 hover:shadow-md'} transition-all group"
              >
                <div
                  class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                  {step.done
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-indigo-300 group-hover:border-indigo-500'}"
                >
                  {#if step.done}
                    <svg
                      class="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  {/if}
                </div>
                <span
                  class="text-sm font-bold {step.done
                    ? 'text-indigo-400 line-through'
                    : 'text-indigo-900'}">{step.label}</span
                >
              </a>
            {/each}
          </div>
        </Card>
      {/if}
    {/if}

    <!-- ── KPI Row ─────────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- Revenue this month -->
      <Card
        class="bg-gradient-to-br from-indigo-600 to-violet-600 border-none p-5 text-white shadow-lg shadow-indigo-100"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-bold text-indigo-100 uppercase tracking-wider">
            Revenue · Month
          </p>
          <TrendingUp class="w-4 h-4 text-indigo-300" />
        </div>
        <p class="text-2xl font-black tracking-tight">
          {currency(stats.revenueThisMonth)}
        </p>
        <p class="text-xs text-indigo-200 mt-1.5 font-medium">
          All-time: {currency(stats.revenueTotal)}
        </p>
      </Card>

      <!-- Revenue this week -->
      <Card
        class="p-5 hover:shadow-md transition-shadow"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Revenue · Week
          </p>
          <div class="p-1.5 rounded-lg bg-blue-50 text-blue-500">
            <TrendingUp class="w-3.5 h-3.5" />
          </div>
        </div>
        <p class="text-2xl font-black text-gray-900 tracking-tight">
          {currency(stats.revenueThisWeek)}
        </p>
        <p class="text-xs text-gray-400 mt-1.5">
          Today: {currency(stats.revenueToday)}
        </p>
      </Card>

      <!-- Orders this month -->
      <Card
        class="p-5 hover:shadow-md transition-shadow"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Orders · Month
          </p>
          <div class="p-1.5 rounded-lg bg-emerald-50 text-emerald-500">
            <ShoppingCart class="w-3.5 h-3.5" />
          </div>
        </div>
        <p class="text-2xl font-black text-gray-900 tracking-tight">
          {stats.ordersThisMonth}
        </p>
        <p class="text-xs text-gray-400 mt-1.5">Total: {stats.orders} orders</p>
      </Card>

      <!-- Pending / active orders -->
      <Card
        onclick={() => goto("/admin/orders")}
        class="p-5 hover:shadow-md transition-shadow group cursor-pointer"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Active Orders
          </p>
          <div class="p-1.5 rounded-lg bg-amber-50 text-amber-500">
            <Clock class="w-3.5 h-3.5" />
          </div>
        </div>
        <p class="text-2xl font-black text-gray-900 tracking-tight">
          {stats.ordersPending}
        </p>
        <p
          class="text-xs text-gray-400 mt-1.5 flex items-center gap-1 group-hover:text-indigo-500 transition-colors"
        >
          View orders <ArrowUpRight class="w-3 h-3" />
        </p>
      </Card>
    </div>

    <!-- ── Middle row: Chart + Status breakdown ────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Revenue chart (14 days) -->
      <div
        class="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
      >
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-sm font-bold text-gray-900">Revenue Trend</h2>
            <p class="text-xs text-gray-400 mt-0.5">Last 14 days</p>
          </div>
          <span
            class="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100"
          >
            {fullCurrency(
              stats.revenueTrend.reduce((a, d) => a + d.revenue, 0),
            )}
          </span>
        </div>

        {#if chartMax <= 1}
          <div
            class="flex flex-col items-center justify-center h-28 text-gray-300 gap-2"
          >
            <TrendingUp class="w-8 h-8" />
            <p class="text-sm font-medium">No revenue data yet</p>
          </div>
        {:else}
          <!-- SVG bar chart -->
          <div class="overflow-hidden">
            <svg
              viewBox="0 0 {CHART_W} {CHART_H + 22}"
              class="w-full"
              role="img"
              aria-label="Revenue trend chart"
            >
              <!-- Grid lines -->
              {#each [0.25, 0.5, 0.75, 1] as frac}
                <line
                  x1="0"
                  y1={CHART_H - frac * CHART_H}
                  x2={CHART_W}
                  y2={CHART_H - frac * CHART_H}
                  stroke="#f3f4f6"
                  stroke-width="1"
                />
              {/each}

              <!-- Bars -->
              {#each stats.revenueTrend as point, i}
                {@const today = isToday(point.date)}
                <g>
                  <!-- Bar -->
                  <rect
                    x={barX(i)}
                    y={barY(point.revenue)}
                    width={BAR_W}
                    height={barHeight(point.revenue)}
                    rx="3"
                    fill={today
                      ? "#4f46e5"
                      : point.revenue > 0
                        ? "#a5b4fc"
                        : "#f3f4f6"}
                    class="transition-all duration-200"
                  />
                  <!-- Day label -->
                  <text
                    x={barX(i) + BAR_W / 2}
                    y={CHART_H + 16}
                    text-anchor="middle"
                    fill={today ? "#4f46e5" : "#9ca3af"}
                    font-size="9"
                    font-weight={today ? "700" : "500"}
                    >{dayLabel(point.date)}</text
                  >
                  <!-- Tooltip title (invisible, for accessibility) -->
                  <title
                    >{point.date}: {fullCurrency(point.revenue)} ({point.orders}
                    orders)</title
                  >
                </g>
              {/each}
            </svg>
          </div>

          <!-- Chart legend -->
          <div class="flex items-center gap-4 mt-3">
            <div class="flex items-center gap-1.5 text-xs text-gray-400">
              <span class="w-2.5 h-2.5 rounded bg-indigo-500 inline-block"
              ></span> Today
            </div>
            <div class="flex items-center gap-1.5 text-xs text-gray-400">
              <span class="w-2.5 h-2.5 rounded bg-indigo-200 inline-block"
              ></span> With revenue
            </div>
            <div class="flex items-center gap-1.5 text-xs text-gray-400">
              <span class="w-2.5 h-2.5 rounded bg-gray-100 inline-block"></span>
              No orders
            </div>
          </div>
        {/if}
      </div>

      <!-- Order status breakdown -->
      <div class="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-sm font-bold text-gray-900">Orders by Status</h2>
          <a
            href="/admin/orders"
            class="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
            >View all →</a
          >
        </div>

        {#if totalOrdersForBar === 0}
          <div
            class="flex flex-col items-center justify-center h-28 text-gray-300 gap-2"
          >
            <ShoppingCart class="w-8 h-8" />
            <p class="text-sm font-medium">No orders yet</p>
          </div>
        {:else}
          <!-- Stacked bar -->
          <div class="flex rounded-full overflow-hidden h-2.5 mb-5 gap-px">
            {#each Object.entries(stats.ordersByStatus) as [status, n]}
              <div
                class="{STATUS_CHART_COLORS[status] ??
                  'bg-gray-300'} transition-all"
                style="width: {(n / totalOrdersForBar) * 100}%"
                title="{statusLabel(status)}: {n}"
              ></div>
            {/each}
          </div>

          <div class="space-y-2.5">
            {#each Object.entries(stats.ordersByStatus).sort((a, b) => b[1] - a[1]) as [status, n]}
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span
                    class="w-2 h-2 rounded-full flex-shrink-0 {STATUS_CHART_COLORS[
                      status
                    ] ?? 'bg-gray-300'}"
                  ></span>
                  <span class="text-xs font-medium text-gray-600"
                    >{statusLabel(status)}</span
                  >
                </div>
                <div class="flex items-center gap-2">
                  <div
                    class="w-16 bg-gray-50 rounded-full h-1.5 overflow-hidden"
                  >
                    <div
                      class="{STATUS_CHART_COLORS[status] ??
                        'bg-gray-300'} h-full rounded-full"
                      style="width: {(n / totalOrdersForBar) * 100}%"
                    ></div>
                  </div>
                  <span class="text-xs font-bold text-gray-700 w-5 text-right"
                    >{n}</span
                  >
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Bottom row: Recent orders + Top products ────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent orders -->
      <Card
        class="lg:col-span-2 shadow-sm overflow-hidden p-0"
      >
        <div
          class="px-6 py-4 border-b border-gray-50 flex items-center justify-between"
        >
          <h2 class="text-sm font-bold text-gray-900">Recent Orders</h2>
          <Button
            href="/admin/orders"
            variant="secondary"
            size="sm"
            class="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors border-none p-0 h-auto"
          >
            All orders <ArrowUpRight class="w-3 h-3 ml-1" />
          </Button>
        </div>

        {#if stats.recentOrders.length === 0}
          <div class="py-16 flex flex-col items-center gap-2 text-gray-300">
            <ShoppingCart class="w-8 h-8" />
            <p class="text-sm font-medium">No orders yet</p>
          </div>
        {:else}
          <div class="divide-y divide-gray-50">
            {#each stats.recentOrders as o}
              <a
                href="/admin/orders/{o.id}"
                class="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors group"
              >
                <Badge
                  class="font-mono text-indigo-500 bg-indigo-50 border-none font-bold"
                >
                  #{String(o.id).padStart(5, "0")}
                </Badge>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors"
                  >
                    {o.buyer_ref ?? "Guest Buyer"}
                  </p>
                  <p
                    class="text-[10px] text-gray-400 uppercase tracking-wide font-bold"
                  >
                    {o.channel}
                  </p>
                </div>
                <Badge
                  class="px-2 py-0.5 border {STATUS_BG[
                    o.status
                  ] ?? 'bg-gray-50 border-gray-100'} {STATUS_TEXT[o.status] ??
                    'text-gray-600'} flex-shrink-0"
                >
                  {statusLabel(o.status)}
                </Badge>
                <span
                  class="text-sm font-black text-gray-900 flex-shrink-0 w-20 text-right"
                >
                  {fullCurrency(o.total)}
                </span>
                <span
                  class="text-[10px] text-gray-400 flex-shrink-0 w-14 text-right"
                  >{relativeDate(o.created_at)}</span
                >
              </a>
            {/each}
          </div>
        {/if}
      </Card>

      <!-- Top products + Quick links -->
      <div class="space-y-6">
        <!-- Top selling products -->
        <div
          class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div class="px-6 py-4 border-b border-gray-50">
            <h2 class="text-sm font-bold text-gray-900">Top Products</h2>
          </div>
          {#if stats.topProducts.length === 0}
            <div class="py-10 flex flex-col items-center gap-2 text-gray-300">
              <Package class="w-7 h-7" />
              <p class="text-xs font-medium">No sales data yet</p>
            </div>
          {:else}
            {@const maxUnits = Math.max(
              ...stats.topProducts.map((p) => p.units_sold),
              1,
            )}
            <div class="divide-y divide-gray-50">
              {#each stats.topProducts as p, i}
                <div class="px-6 py-3.5">
                  <div class="flex items-center gap-2 mb-1.5">
                    <span
                      class="text-[10px] font-black text-gray-300 w-4 flex-shrink-0"
                      >#{i + 1}</span
                    >
                    <p
                      class="text-sm font-bold text-gray-900 truncate flex-1"
                      title={p.title}
                    >
                      {p.title}
                    </p>
                    <span class="text-xs font-bold text-gray-500 flex-shrink-0"
                      >{p.units_sold} sold</span
                    >
                  </div>
                  <div class="flex items-center gap-2 pl-6">
                    <div
                      class="flex-1 bg-gray-50 rounded-full h-1.5 overflow-hidden"
                    >
                      <div
                        class="bg-indigo-400 h-full rounded-full transition-all duration-500"
                        style="width: {(p.units_sold / maxUnits) * 100}%"
                      ></div>
                    </div>
                    <span
                      class="text-[10px] font-bold text-indigo-500 flex-shrink-0"
                      >{currency(p.revenue)}</span
                    >
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- ── Catalog quick-links ─────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      {#each countCards as card}
        <Card
          onclick={() => goto(card.href)}
          class="p-4 hover:shadow-md transition-shadow flex items-center gap-3 group cursor-pointer"
        >
          <div class="p-2 rounded-lg {card.color} flex-shrink-0">
            <card.icon class="w-4 h-4" />
          </div>
          <div>
            <p
              class="text-[10px] font-bold text-gray-400 uppercase tracking-wider"
            >
              {card.label}
            </p>
            <p class="text-lg font-black text-gray-900 leading-none mt-0.5">
              {stats[card.key as keyof Stats] ?? 0}
            </p>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>
