<script lang="ts">
  import { onMount, tick } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { Check, Info } from "@lucide/svelte";

  // New Modular Components
  import StoreSettings from "$lib/components/admin/settings/StoreSettings.svelte";
  import AiSettings from "$lib/components/admin/settings/AiSettings.svelte";
  import MessagingSettings from "$lib/components/admin/settings/MessagingSettings.svelte";
  import PaymentSettings from "$lib/components/admin/settings/PaymentSettings.svelte";
  import UsersSettings from "$lib/components/admin/settings/UsersSettings.svelte";
  import ServerSettings from "$lib/components/admin/settings/ServerSettings.svelte";
  import MaintenanceSettings from "$lib/components/admin/settings/MaintenanceSettings.svelte";

  // Per-store settings (require a store is selected)
  let storeSettings = $state<Record<string, string | boolean>>({});
  // Server settings (always available)
  let serverSettings = $state<Record<string, string>>({});

  let saving = $state(false);
  let saved = $state(""); // key of tab that just saved
  let error = $state("");
  let activeTab = $state<string>("store");

  let userRole = $state("");
  let currentUserId = $state<number | null>(null);
  let needsPasswordChange = $state(false);

  // Inputs for sensitive fields (not in storeSettings since server masks them)
  let claudeKeyInput = $state("");
  let geminiKeyInput = $state("");
  let openaiKeyInput = $state("");
  let serperKeyInput = $state("");
  let telegramKeyInput = $state("");
  let paymentApiKeyInput = $state("");
  let paymentWebhookSecretInput = $state("");
  let paymentInstructionsInput = $state("");
  let paymentLinkTemplateInput = $state("");
  let assistedLabelInput = $state("");

  // Google Keys specific state
  let googlePlacesBrowserKeyInput = $state("");
  let googleMapsEmbedKeyInput = $state("");
  let showGooglePlacesKey = $state(false);
  let showGoogleMapsKey = $state(false);

  // Visibility toggles for keys
  let showClaudeKey = $state(false);
  let showGeminiKey = $state(false);
  let showOpenaiKey = $state(false);
  let showSerperKey = $state(false);
  let showTelegramKey = $state(false);
  let showPaymentApiKey = $state(false);
  let showPaymentWebhookSecret = $state(false);

  // Telegram/Messaging specific state
  let telegramMode = $state<"polling" | "webhook">("polling");
  let telegramCustomUrl = $state("");
  let telegramBotStatus = $state<"idle" | "checking" | "active" | "failed">("idle");
  let telegramBotStatusInfo = $state<any>(null);
  let telegramWebhookUrlCopied = $state(false);

  // AI Sync specific state
  let aiGatewayStatus = $state<"idle" | "synced" | "failed">("idle");
  let aiGatewayReason = $state("");

  // Temp MCP Key state
  let tempMcpKey = $state("");
  let tempMcpExpiry = $state("");
  let tempKeyLoading = $state(false);
  let tempKeyDuration = $state(60);
  let alerted = $state("");

  // User management state
  let usersList = $state<any[]>([]);
  let showAddUserModal = $state(false);
  let newUserName = $state("");
  let newUserPass = $state("");
  let newUserFirstName = $state("");
  let newUserLastName = $state("");
  let newUserEmail = $state("");
  let newUserMobile = $state("");
  let newUserRole = $state("merchandising");
  let showNewUserPass = $state(false);
  let editingUser = $state<any>(null);
  let showEditUserModal = $state(false);
  let showEditUserPass = $state(false);

  const token = () => localStorage.getItem("pc_token") ?? "";

  // Helpers
  function val(key: string, fallback = ""): string {
    return String(storeSettings[key] ?? fallback);
  }
  function set(key: string, value: string) {
    storeSettings = { ...storeSettings, [key]: value };
  }

  // UX-R2-2: Unsaved changes tracking
  let initialSnap = $state<string>("");
  function getSnap(): string {
    if (activeTab === "store") return JSON.stringify(storeSettings);
    if (activeTab === "ai")
      return JSON.stringify({
        ...storeSettings,
        k1: claudeKeyInput,
        k2: geminiKeyInput,
        k3: openaiKeyInput,
        k4: serperKeyInput,
      });
    if (activeTab === "telegram")
      return JSON.stringify({
        ...storeSettings,
        k: telegramKeyInput,
        m: telegramMode,
        u: telegramCustomUrl,
      });
    if (activeTab === "payments")
      return JSON.stringify({
        ...storeSettings,
        k1: paymentApiKeyInput,
        k2: paymentWebhookSecretInput,
        k3: paymentInstructionsInput,
        k4: paymentLinkTemplateInput,
        k5: assistedLabelInput,
      });
    if (activeTab === "maintenance")
      return JSON.stringify({
        ...storeSettings,
        k1: googlePlacesBrowserKeyInput,
        k2: googleMapsEmbedKeyInput,
      });
    if (activeTab === "server") return JSON.stringify(serverSettings);
    return "";
  }
  function updateSnap() {
    initialSnap = getSnap();
  }
  function isDirty(): boolean {
    if (activeTab === "users") return false;
    return getSnap() !== initialSnap;
  }

  function switchTab(tab: string) {
    if (tab === activeTab) return;
    if (isDirty()) {
      if (!confirm("You have unsaved changes on this tab. Leave anyway?"))
        return;
    }
    activeTab = tab;
    updateSnap();
  }

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

  // Preset model lists per provider
  const PROVIDER_MODELS: Record<string, Array<[string, string]>> = {
    claude: [
      ["", "Default (claude-sonnet-4-5)"],
      ["claude-opus-4-5", "claude-opus-4-5 — Most capable"],
      ["claude-haiku-4-5", "claude-haiku-4-5 — Fast"],
    ],
    gemini: [
      ["", "Default (gemini-2.0-flash)"],
      ["gemini-2.0-flash", "gemini-2.0-flash"],
      ["gemini-1.5-pro", "gemini-1.5-pro"],
      ["gemini-1.5-flash", "gemini-1.5-flash"],
    ],
    openai: [
      ["", "Default (gpt-4o-mini)"],
      ["gpt-4o", "gpt-4o"],
      ["gpt-4o-mini", "gpt-4o-mini — Fast"],
      ["o1", "o1"],
    ],
  };

  function setProvider(pid: string) {
    set("ai_provider", pid);
    set("ai_model", "");
    customModelMode = false;
  }

  let customModelMode = $state(false);

  let whatsappStatus = $state<"active" | "failed">("failed");

  // Lifecycle
  onMount(async () => {
    const t = token();
    if (t) {
      try {
        const payload = JSON.parse(atob(t.split(".")[1]));
        userRole = payload.role;
        currentUserId = payload.sub;
        if (!activeStore.slug) activeTab = "server";
        else activeTab = "store";
      } catch (e) { console.error("Token parse error", e); }

      try {
        const authRes = await fetch("/api/auth", { headers: { Authorization: `Bearer ${t}` } });
        if (authRes.ok) {
          const authData = await authRes.json();
          needsPasswordChange = authData.needsPasswordChange === true;
        }
      } catch { /* skip */ }
    }
    await loadServer();
    const savedTab = localStorage.getItem("settings_active_tab");
    if (savedTab) {
      const tabs = visibleTabs();
      if (tabs.some((t) => t[0] === savedTab)) activeTab = savedTab;
    }
  });

  $effect(() => {
    if (activeTab) localStorage.setItem("settings_active_tab", activeTab);
    if (!activeStore.slug) {
      storeSettings = {};
    } else {
      // Ensure we don't call this during SSR (though $effect shouldn't run there)
      loadStore();
    }
  });

  // Data Loading
  async function loadStore() {
    if (!activeStore.slug) return;
    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      storeSettings = await res.json();
      paymentInstructionsInput = val("payment_instructions");
      paymentLinkTemplateInput = val("payment_link_template");
      assistedLabelInput = val("assisted_label");
      googlePlacesBrowserKeyInput = ""; // Masked on server
      googleMapsEmbedKeyInput = ""; // Masked on server

      // Set connection mode based on derived state
      telegramMode = val("telegram_webhook_url") ? "webhook" : "polling";
      telegramCustomUrl = val("telegram_webhook_url") === defaultTelegramWebhookUrl ? "" : val("telegram_webhook_url");
      
      // Check if custom model mode is needed
      const prov = val("ai_provider", "claude");
      const model = val("ai_model");
      if (model && !(PROVIDER_MODELS[prov] ?? []).some(m => m[0] === model)) {
        customModelMode = true;
      } else {
        customModelMode = false;
      }
      
      updateSnap();
      checkBotStatus();
    }
  }

  async function loadServer() {
    const res = await fetch("/api/settings", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      serverSettings = await res.json();
      // Check if WhatsApp is configured
      if (serverSettings.whatsapp_configured) {
        whatsappStatus = "active";
      } else {
        whatsappStatus = "failed";
      }
      updateSnap();
    }
  }

  async function checkBotStatus() {
    if (!activeStore.slug) return;
    telegramBotStatus = "checking";
    try {
      const res = await fetch(`/api/settings/telegram-bot-status?store=${activeStore.slug}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        telegramBotStatusInfo = await res.json();
        telegramBotStatus = "active";
      } else {
        telegramBotStatus = "failed";
      }
    } catch {
      telegramBotStatus = "failed";
    }
  }

  const defaultTelegramWebhookUrl = $derived(
    serverSettings.gateway_url && activeStore.slug
      ? `${serverSettings.gateway_url.replace(/\/$/, "")}/webhooks/telegram/${activeStore.slug}`
      : ""
  );

  // Saving CRUD
  async function saveStore() {
    if (!activeStore.slug) return;
    saving = true;
    saved = "";
    error = "";
    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({
        store_display_name: val("store_display_name"),
        store_currency: val("store_currency"),
        store_timezone: val("store_timezone"),
        allows_pickup: val("allows_pickup", "0"),
      }),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      saved = "store";
      updateSnap();
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  async function saveAi() {
    if (!activeStore.slug) return;
    saving = true;
    saved = "";
    error = "";
    const payload: Record<string, string> = {
      ai_enabled: val("ai_enabled", "0"),
      ai_provider: val("ai_provider", "claude"),
      ai_model: val("ai_model"),
      ai_system_prompt: val("ai_system_prompt"),
    };
    if (claudeKeyInput) payload.claude_api_key = claudeKeyInput.trim();
    if (geminiKeyInput) payload.gemini_api_key = geminiKeyInput.trim();
    if (openaiKeyInput) payload.openai_api_key = openaiKeyInput.trim();
    if (serperKeyInput) payload.serper_api_key = serperKeyInput.trim();

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      claudeKeyInput = geminiKeyInput = openaiKeyInput = serperKeyInput = "";
      saved = "ai";
      updateSnap();
      aiGatewayStatus = "checking" as any;
      setTimeout(async () => {
        try {
          const gwRes = await fetch(`/api/settings/ai-sync-status?store=${activeStore.slug}`, {
            headers: { Authorization: `Bearer ${token()}` }
          });
          if (gwRes.ok) {
            const { synced, reason } = await gwRes.json();
            aiGatewayStatus = synced ? "synced" : "failed";
            aiGatewayReason = reason ?? "";
          } else { aiGatewayStatus = "failed"; }
        } catch { aiGatewayStatus = "failed"; }
      }, 1500);
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  async function saveMessaging() {
    if (!activeStore.slug) return;
    saving = true;
    saved = "";
    error = "";
    const webhookUrl = telegramMode === "webhook" ? telegramCustomUrl.trim() || defaultTelegramWebhookUrl || null : null;
    const payload: Record<string, string | null> = {
      telegram_enabled: val("telegram_enabled", "0"),
      whatsapp_enabled: val("whatsapp_enabled", "0"),
      telegram_webhook_url: webhookUrl,
      telegram_notify_chat_id: String(storeSettings.telegram_notify_chat_id ?? ""),
      whatsapp_notify_number: String(storeSettings.whatsapp_notify_number ?? ""),
    };
    if (telegramKeyInput) payload.telegram_bot_token = telegramKeyInput.trim();
    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      telegramKeyInput = "";
      saved = "telegram";
      updateSnap();
      checkBotStatus();
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  function togglePaymentMethod(id: string) {
    let m: string[] = [];
    try { m = JSON.parse(val("payment_methods", "[]")); } catch { m = []; }
    if (m.includes(id)) m = m.filter((x) => x !== id);
    else m.push(id);
    if (id === "cod") set("allow_cod", m.includes("cod") ? "1" : "0");
    else {
      const current = val("payment_provider", "none");
      if (m.includes(id) && (current === "none" || current === "cod")) set("payment_provider", id);
      else if (!m.includes(id) && current === id) {
        const remaining = m.filter(x => ["mock", "assisted", "paymongo", "stripe"].includes(x));
        set("payment_provider", remaining[0] || "none");
      }
    }
    set("payment_methods", JSON.stringify([...new Set(m)]));
  }

  async function savePayments() {
    if (!activeStore.slug) return;
    saving = true;
    saved = "";
    error = "";
    const provider = val("payment_provider", "none");
    const payload: Record<string, string> = {
      payment_provider: provider === "none" ? "" : provider,
      payment_public_key: String(storeSettings.payment_public_key ?? ""),
      payment_instructions: paymentInstructionsInput.trim(),
      payment_link_template: paymentLinkTemplateInput.trim(),
      assisted_label: assistedLabelInput.trim(),
      allow_cod: String(storeSettings.allow_cod ?? "1"),
      payment_methods: val("payment_methods", "[]"),
    };
    if (paymentApiKeyInput) payload.payment_api_key = paymentApiKeyInput.trim();
    if (paymentWebhookSecretInput) payload.payment_webhook_secret = paymentWebhookSecretInput.trim();

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      paymentApiKeyInput = paymentWebhookSecretInput = "";
      saved = "payments";
      updateSnap();
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  async function saveMaintenance() {
    if (!activeStore.slug) return;
    saving = true;
    saved = "";
    error = "";
    const payload: Record<string, string | null | undefined> = {
      google_places_browser_key: googlePlacesBrowserKeyInput.trim() || (storeSettings.google_places_browser_key_set ? undefined : null),
      google_maps_embed_key: googleMapsEmbedKeyInput.trim() || (storeSettings.google_maps_embed_key_set ? undefined : null),
    };
    
    // Remove undefined values (they mean keep existing)
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      googlePlacesBrowserKeyInput = googleMapsEmbedKeyInput = "";
      saved = "maintenance";
      updateSnap();
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  async function saveServer() {
    saving = true;
    saved = "";
    error = "";
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(serverSettings),
    });
    saving = false;
    if (res.ok) {
      serverSettings = await res.json();
      saved = "server";
      updateSnap();
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  async function generateMcpKey() {
    tempKeyLoading = true;
    error = "";
    try {
      const res = await fetch("/api/auth/temp-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ expiresIn: tempKeyDuration }),
      });
      if (res.ok) {
        const data = await res.json();
        tempMcpKey = data.token;
        tempMcpExpiry = data.expiresAt;
      } else {
        const d = await res.json();
        error = d.error ?? "Failed to generate key";
      }
    } catch { error = "Network error"; }
    finally { tempKeyLoading = false; }
  }

  async function loadUsers() {
    if (activeTab !== "users") return;
    const url = activeStore.slug ? `/api/stores/${activeStore.slug}/users` : `/api/users`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) usersList = await res.json();
  }

  async function addUser() {
    if (!newUserName || !newUserPass) return;
    saving = true;
    const url = activeStore.slug ? `/api/stores/${activeStore.slug}/users` : `/api/users`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({
        username: newUserName, password: newUserPass, role: newUserRole,
        first_name: newUserFirstName, last_name: newUserLastName,
        email: newUserEmail, mobile: newUserMobile
      }),
    });
    saving = false;
    if (res.ok) {
      newUserName = newUserPass = newUserFirstName = newUserLastName = newUserEmail = newUserMobile = "";
      showAddUserModal = false;
      loadUsers();
    } else {
      const d = await res.json();
      error = d.error ?? "Failed to add user";
    }
  }

  async function updateUser() {
    if (!editingUser) return;
    saving = true;
    const payload: any = {
      username: editingUser.username, role: editingUser.role,
      first_name: editingUser.first_name, last_name: editingUser.last_name,
      email: editingUser.email, mobile: editingUser.mobile
    };
    if (editingUser.newPassword) payload.password = editingUser.newPassword;
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      showEditUserModal = false;
      loadUsers();
    } else {
      const d = await res.json();
      error = d.error ?? "Failed to update user";
    }
  }

  async function deleteUser(id: number) {
    if (!confirm("Are you sure you want to remove this user?")) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) loadUsers();
  }

  function openEditModal(user: any) {
    editingUser = { ...user, newPassword: "" };
    showEditUserModal = true;
  }

  function setServer(key: string, value: string) {
    serverSettings = { ...serverSettings, [key]: value };
  }

  onMount(() => {
    tick().then(() => {
      if (activeTab === 'users') loadUsers();
    });
  });

  $effect(() => {
    if (activeTab === 'users') loadUsers();
  });
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

  {#if error}
    <div class="mb-6 animate-in slide-in-from-top-4">
       <div class="rounded-2xl bg-red-50 border border-red-100 p-4 flex items-center gap-3 text-red-700 shadow-sm">
          <div class="w-8 h-8 rounded-xl bg-white flex items-center justify-center font-black">!</div>
          <p class="text-sm font-bold">{error}</p>
          <button onclick={() => error = ""} class="ml-auto text-red-300 hover:text-red-500 font-bold">dismiss</button>
       </div>
    </div>
  {/if}

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
  <div class="min-h-[500px]">
    {#if activeTab === "store"}
      <StoreSettings 
        {activeStore} {serverSettings} {storeSettings} {val} {set} {saving} {saved} {saveStore} 
      />
    {:else if activeTab === "ai"}
      <AiSettings
        {activeStore} {storeSettings} {val} {set} {saving} {saved} 
        {aiGatewayStatus} {aiGatewayReason} {PROVIDER_MODELS} {setProvider}
        bind:customModelMode
        bind:claudeKeyInput bind:geminiKeyInput bind:openaiKeyInput bind:serperKeyInput
        bind:showClaudeKey bind:showGeminiKey bind:showOpenaiKey bind:showSerperKey
        {tempMcpKey} {tempMcpExpiry} {tempKeyLoading} bind:tempKeyDuration {alerted}
        {generateMcpKey} {saveAi}
      />
    {:else if activeTab === "telegram"}
      <MessagingSettings
        {activeStore} {storeSettings} {val} {set} {saving} {saved}
        bind:telegramMode bind:telegramCustomUrl bind:telegramKeyInput bind:showTelegramKey
        {telegramBotStatus} {telegramBotStatusInfo}
        bind:telegramWebhookUrlCopied {defaultTelegramWebhookUrl}
        {whatsappStatus}
        saveMessaging={saveMessaging}
      />
    {:else if activeTab === "payments"}
      <PaymentSettings
        {activeStore} {storeSettings} {val} {set} {saving} {saved}
        {togglePaymentMethod}
        bind:assistedLabelInput bind:paymentInstructionsInput bind:paymentLinkTemplateInput
        bind:paymentApiKeyInput bind:showPaymentApiKey 
        bind:showPaymentWebhookSecret bind:paymentWebhookSecretInput
        {savePayments}
      />
    {:else if activeTab === "users"}
      <UsersSettings
        {activeStore} {usersList} {userRole}
        bind:showAddUserModal bind:showEditUserModal
        bind:newUserName bind:newUserPass bind:newUserFirstName bind:newUserLastName bind:newUserEmail bind:newUserMobile bind:newUserRole
        bind:showNewUserPass bind:editingUser bind:showEditUserPass
        {saving} {error} {addUser} {updateUser} {deleteUser} {openEditModal}
      />
    {:else if activeTab === "maintenance"}
      <MaintenanceSettings
        {activeStore} {storeSettings} {val} {set} {saving} {saved}
        bind:googlePlacesBrowserKeyInput bind:googleMapsEmbedKeyInput
        bind:showGooglePlacesKey bind:showGoogleMapsKey
        onSave={saveMaintenance}
      />
    {:else if activeTab === "server"}
      <ServerSettings
        {userRole} {serverSettings} {setServer} {saving} {saved} {saveServer}
      />
    {/if}
  </div>
</div>
