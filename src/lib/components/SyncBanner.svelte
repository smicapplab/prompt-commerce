<script lang="ts">
  import { RefreshCw, Check, AlertTriangle } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { fetchSyncStatus, syncToGateway as doSync } from "$lib/syncGateway.js";
  import { onMount } from "svelte";

  import type { SyncBannerProps } from "$lib/types/components.js";

  let { onSyncComplete, dirtyBreakdown }: SyncBannerProps = $props();

  let dirtyCount = $state(0);
  let syncing = $state(false);
  let syncSuccess = $state("");
  let syncError = $state("");

  export async function loadDirtyCount() {
    if (!activeStore.slug) return;
    const s = await fetchSyncStatus(activeStore.slug).catch(() => null);
    dirtyCount = s?.dirty ?? 0;
  }

  async function runSync() {
    if (!activeStore.slug || syncing) return;
    syncing = true;
    syncSuccess = "";
    syncError = "";
    try {
      syncSuccess = await doSync(activeStore.slug);
      dirtyCount = 0;
      if (onSyncComplete) onSyncComplete();
      setTimeout(() => (syncSuccess = ""), 5000);
    } catch (e: any) {
      syncError = e?.message ?? "Sync failed";
      setTimeout(() => (syncError = ""), 6000);
    }
    syncing = false;
  }

  onMount(() => {
    loadDirtyCount();
  });

  // Expose loadDirtyCount to parent if needed
  $effect(() => {
    if (activeStore.slug) loadDirtyCount();
  });
</script>

{#if syncing}
  <div class="flex items-center gap-3 mb-6 rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-800">
    <RefreshCw size={15} class="animate-spin shrink-0" />
    <span>Syncing changes to gateway…</span>
  </div>
{:else if syncSuccess}
  <div class="flex items-center gap-3 mb-6 rounded-2xl border border-green-200 bg-green-50/50 px-4 py-3 text-sm text-green-800">
    <Check size={16} class="shrink-0" />
    <span>{syncSuccess}</span>
  </div>
{:else if syncError}
  <div class="flex items-center gap-3 mb-6 rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-700">
    <AlertTriangle size={16} class="shrink-0" />
    <span>{syncError}</span>
  </div>
{:else if dirtyCount > 0}
  <div class="mb-6 flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm text-orange-800">
    <div class="flex items-center gap-2">
      <RefreshCw size={16} class="text-orange-600 animate-spin-slow" />
      <span class="font-medium">
        {dirtyCount} item{dirtyCount === 1 ? "" : "s"} not yet synced.
        {#if dirtyBreakdown}
          <span class="text-orange-600/70 font-normal ml-1">
            ({dirtyBreakdown.activeDirty} new/edited · {dirtyBreakdown.deletedCount} deleted)
          </span>
        {/if}
      </span>
    </div>
    <Button
      onclick={runSync}
      variant="primary"
      class="bg-orange-600 hover:bg-orange-700 h-8 text-[10px]"
    >
      Sync now
    </Button>
  </div>
{/if}
