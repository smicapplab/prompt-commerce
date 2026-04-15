<script lang="ts">
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { Info, RefreshCw } from "@lucide/svelte";

  // Smart Modular Components
  import StoreSettings from "$lib/components/admin/settings/StoreSettings.svelte";
  import AiSettings from "$lib/components/admin/settings/AiSettings.svelte";
  import MessagingSettings from "$lib/components/admin/settings/MessagingSettings.svelte";
  import PaymentSettings from "$lib/components/admin/settings/PaymentSettings.svelte";
  import UsersSettings from "$lib/components/admin/settings/UsersSettings.svelte";
  import ServerSettings from "$lib/components/admin/settings/ServerSettings.svelte";
  import MaintenanceSettings from "$lib/components/admin/settings/MaintenanceSettings.svelte";

  // Shell State
  let activeTab = $state<string>("store");
  let userRole = $state("");
  let serverSettings = $state<Record<string, any>>({});
  let loading = $state(true);
  let needsPasswordChange = $state(false);

  const token = () => localStorage.getItem("pc_token") ?? "";

  const visibleTabs = $derived(() => {
    const tabs: [string, string][] = [];
    if (activeStore.slug) {
      tabs.push(
        ["store", "Store"],
        ["ai", "AI / LLM"],
        ["telegram", "Messaging"],
        ["payments", "Payments"],
        ["maintenance", "Maintenance"],
      );
    }
    tabs.push(["server", "Server"]);
    const isGlobalAdmin = userRole === "super_admin" || userRole === "admin";
    const isStoreAdmin = activeStore.slug && userRole === "store_admin";
    if (isGlobalAdmin || isStoreAdmin) tabs.push(["users", "Users"]);
    return tabs;
  });

  onMount(async () => {
    const t = token();
    if (t) {
      try {
        const payload = JSON.parse(atob(t.split(".")[1]));
        userRole = payload.role;
        if (!activeStore.slug) activeTab = "server";
      } catch (e) {}

      try {
        const authRes = await fetch("/api/auth", { headers: { Authorization: `Bearer ${t}` } });
        if (authRes.ok) {
          const authData = await authRes.json();
          needsPasswordChange = authData.needsPasswordChange === true;
        }
      } catch { /* skip */ }
    }

    // Load server settings for shared gateway info
    try {
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) serverSettings = await res.json();
    } catch (e) {}

    const savedTab = localStorage.getItem("settings_active_tab");
    if (savedTab) {
      const tabs = visibleTabs();
      if (tabs.some((t) => t[0] === savedTab)) activeTab = savedTab;
    }
    loading = false;
  });

  $effect(() => {
    if (activeTab) localStorage.setItem("settings_active_tab", activeTab);
  });

  function switchTab(tab: string) {
    activeTab = tab;
  }
</script>

<svelte:head><title>Settings — Prompt Commerce</title></svelte:head>

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto">
  <!-- Top Bar -->
  <div class="flex items-center justify-between mb-8">
    <div>
       <h1 class="text-2xl font-black text-gray-900 tracking-tight">System Control</h1>
       <div class="flex items-center gap-2 mt-1">
          <div class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
          <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Admin Dashboard / Configuration</span>
       </div>
    </div>
    
    {#if needsPasswordChange}
      <div class="flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 shadow-sm animate-in bounce-in">
        <Info size={18} class="shrink-0" />
        <div class="text-[11px] leading-tight">
          <p class="font-black uppercase tracking-tight">Security Alert</p>
          <button onclick={() => activeTab = 'users'} class="font-medium hover:underline">Change your default password &rarr;</button>
        </div>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <RefreshCw size={32} class="animate-spin text-gray-300" />
    </div>
  {:else}
    <!-- Tab Switcher -->
    <div class="flex flex-wrap gap-2 mb-10 bg-gray-100 p-1.5 rounded-2xl w-fit">
      {#each visibleTabs() as [tab, label]}
        <button
          onclick={() => switchTab(tab)}
          class="px-6 py-2.5 rounded-xl text-sm font-bold transition-all
            {activeTab === tab
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}"
        >
          {label}
        </button>
      {/each}
    </div>

    <!-- Tab Content -->
    <div class="min-h-125">
      {#if activeTab === "store"}
        <StoreSettings {serverSettings} />
      {:else if activeTab === "ai"}
        <AiSettings />
      {:else if activeTab === "telegram"}
        <MessagingSettings />
      {:else if activeTab === "payments"}
        <PaymentSettings />
      {:else if activeTab === "maintenance"}
        <MaintenanceSettings />
      {:else if activeTab === "users"}
        <UsersSettings />
      {:else if activeTab === "server"}
        <ServerSettings />
      {/if}
    </div>
  {/if}
</div>
