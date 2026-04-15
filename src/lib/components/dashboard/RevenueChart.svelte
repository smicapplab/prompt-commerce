<script lang="ts">
  import { TrendingUp } from "@lucide/svelte";
  import { formatCurrency } from "$lib/utils/format.js";
  import type { Stats } from "$lib/types/dashboard.js";

  interface Props {
    stats: Stats;
  }

  let { stats }: Props = $props();

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

  const totalRevenueLast14Days = $derived(
    stats.revenueTrend.reduce((a, d) => a + d.revenue, 0)
  );
</script>

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
      {formatCurrency(totalRevenueLast14Days)}
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
              >{point.date}: {formatCurrency(point.revenue)} ({point.orders}
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
