<script lang="ts">
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import {
    Check,
    Eye,
    EyeOff,
    Shield,
    Trash2,
    UserRoundCog,
    UserRoundPlus,
    Lock,
    Pencil,
  } from "@lucide/svelte";

  // Per-store settings (require a store to be selected)
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

  const visibleTabs = $derived(() => {
    const tabs: [string, string][] = [];
    if (activeStore.slug) {
      tabs.push(
        ["store", "Store"],
        ["ai", "AI / LLM"],
        ["telegram", "Telegram"],
        ["payments", "Payments"],
      );
    }
    tabs.push(["server", "Server"]);

    // Users tab: Global admins can always see it. Store admins only see it if a store is selected.
    const isGlobalAdmin = userRole === "super_admin" || userRole === "admin";
    const isStoreAdmin = activeStore.slug && userRole === "store_admin";

    if (isGlobalAdmin || isStoreAdmin) {
      tabs.push(["users", "Users"]);
    }
    return tabs;
  });

  // Ensure activeTab is valid when tabs change
  $effect(() => {
    const tabs = visibleTabs();
    if (!tabs.some((t) => t[0] === activeTab)) {
      activeTab = tabs[0]?.[0] || "server";
    }
  });

  // Gateway sync status for AI config
  let aiGatewayStatus = $state<"idle" | "synced" | "failed">("idle");
  let aiGatewayReason = $state<string>("");

  let showClaudeKey = $state(false);
  let showGeminiKey = $state(false);
  let showOpenaiKey = $state(false);
  let showSerperKey = $state(false);
  let showTelegramKey = $state(false);
  let showPaymentApiKey = $state(false);
  let showPaymentWebhookSecret = $state(false);

  // Inputs for sensitive fields (not in storeSettings since server masks them)
  let claudeKeyInput = $state("");
  let geminiKeyInput = $state("");
  let openaiKeyInput = $state("");
  let serperKeyInput = $state("");
  let telegramKeyInput = $state("");
  let paymentApiKeyInput = $state("");
  let paymentWebhookSecretInput = $state("");
  
  // Temp MCP Key state
  let tempMcpKey = $state("");
  let tempMcpExpiry = $state("");
  let tempKeyLoading = $state(false);
  let tempKeyDuration = $state(60);
  let alerted = $state("");

  async function generateMcpKey() {
    tempKeyLoading = true;
    error = "";
    try {
      const res = await fetch("/api/auth/temp-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
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
    } catch (e) {
      error = "Network error";
    } finally {
      tempKeyLoading = false;
    }
  }

  const token = () => localStorage.getItem("pc_token") ?? "";

  // User management state
  let usersList = $state<any[]>([]);
  let showAddUserModal = $state(false);
  let newUserName = $state("");
  let newUserPass = $state("");
  let newUserFirstName = $state("");
  let newUserLastName = $state("");
  let newUserEmail = $state("");
  let newUserMobile = $state("");
  let newUserRole = $state("merchandising"); // Default for store level

  let editingUser = $state<any>(null);
  let showEditUserModal = $state(false);

  async function loadUsers() {
    if (!activeTab.includes("users")) return;
    const url = activeStore.slug
      ? `/api/stores/${activeStore.slug}/users`
      : `/api/users`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) usersList = await res.json();
  }

  async function addUser() {
    if (!newUserName || !newUserPass) return;
    saving = true;
    error = "";
    const url = activeStore.slug
      ? `/api/stores/${activeStore.slug}/users`
      : `/api/users`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({
        username: newUserName,
        password: newUserPass,
        role: newUserRole,
        first_name: newUserFirstName,
        last_name: newUserLastName,
        email: newUserEmail,
        mobile: newUserMobile,
      }),
    });
    saving = false;
    if (res.ok) {
      newUserName = "";
      newUserPass = "";
      newUserFirstName = "";
      newUserLastName = "";
      newUserEmail = "";
      newUserMobile = "";
      showAddUserModal = false;
      loadUsers();
    } else {
      const d = await res.json();
      error = d.error ?? "Failed to add user";
    }
  }

  function openEditModal(user: any) {
    editingUser = { ...user, newPassword: "" };
    showEditUserModal = true;
  }

  async function updateUser() {
    if (!editingUser) return;
    saving = true;
    error = "";
    
    const payload: any = {
      username: editingUser.username,
      role: editingUser.role,
      first_name: editingUser.first_name,
      last_name: editingUser.last_name,
      email: editingUser.email,
      mobile: editingUser.mobile,
    };
    if (editingUser.newPassword) {
      payload.password = editingUser.newPassword;
    }

    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      showEditUserModal = false;
      // If the current user just changed their own password, clear the warning banner
      if (editingUser.id === currentUserId && editingUser.newPassword) {
        needsPasswordChange = false;
      }
      editingUser = null;
      loadUsers();
    } else {
      const d = await res.json();
      error = d.error ?? "Failed to update user";
    }
  }

  async function deleteUser(id: number) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) loadUsers();
    else {
      const d = await res.json();
      error = d.error ?? "Delete failed";
    }
  }

  $effect(() => {
    if (activeTab === "users") loadUsers();
  });

  async function loadStore() {
    if (!activeStore.slug) return;
    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      storeSettings = await res.json();
      // If a custom model name was previously saved (not in any preset list), open custom mode.
      customModelMode = savedModelIsCustom();
    }
  }

  async function loadServer() {
    const res = await fetch("/api/settings", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) serverSettings = await res.json();
  }

  async function saveStore(extra: Record<string, string> = {}) {
    if (!activeStore.slug) return;
    saving = true;
    saved = "";
    error = "";
    const payload: Record<string, string> = { ...extra };

    // Collect display fields
    payload.store_display_name = String(storeSettings.store_display_name ?? "");
    payload.store_currency = String(storeSettings.store_currency ?? "");
    payload.store_timezone = String(storeSettings.store_timezone ?? "");

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      saved = "store";
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
    aiGatewayStatus = "idle";
    aiGatewayReason = "";
    const payload: Record<string, string> = {};
    if (claudeKeyInput) payload.claude_api_key = claudeKeyInput;
    if (geminiKeyInput) payload.gemini_api_key = geminiKeyInput;
    if (openaiKeyInput) payload.openai_api_key = openaiKeyInput;
    if (serperKeyInput) payload.serper_api_key = serperKeyInput;
    payload.ai_enabled = String(storeSettings.ai_enabled ?? "0");
    payload.ai_provider = val("ai_provider", "claude");
    payload.ai_model = String(storeSettings.ai_model ?? "");
    payload.ai_system_prompt = String(storeSettings.ai_system_prompt ?? "");

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      claudeKeyInput = "";
      geminiKeyInput = "";
      openaiKeyInput = "";
      serperKeyInput = "";
      saved = "ai";
      // Poll gateway sync status — the server push is fire-and-forget, give it 1.5s
      setTimeout(async () => {
        try {
          const slug = activeStore.slug;
          const gwRes = await fetch(
            `/api/settings/ai-sync-status?store=${slug}`,
            {
              headers: { Authorization: `Bearer ${token()}` },
            },
          );
          if (gwRes.ok) {
            const { synced, reason } = await gwRes.json();
            aiGatewayStatus = synced ? "synced" : "failed";
            aiGatewayReason = reason ?? "";
          } else {
            aiGatewayStatus = "failed";
            aiGatewayReason = "unreachable";
          }
        } catch {
          aiGatewayStatus = "failed";
          aiGatewayReason = "unreachable";
        }
      }, 1500);
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  async function saveTelegram() {
    if (!activeStore.slug) return;
    saving = true;
    saved = "";
    error = "";
    const payload: Record<string, string> = {
      telegram_webhook_url:    String(storeSettings.telegram_webhook_url ?? ""),
      telegram_notify_chat_id: String(storeSettings.telegram_notify_chat_id ?? ""),
    };
    if (telegramKeyInput) payload.telegram_bot_token = telegramKeyInput;

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      telegramKeyInput = "";
      saved = "telegram";
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  async function savePayments() {
    if (!activeStore.slug) return;
    saving = true;
    saved = "";
    error = "";
    const payload: Record<string, string> = {
      payment_provider: val("payment_provider", "mock"),
      payment_public_key: String(storeSettings.payment_public_key ?? ""),
    };
    if (paymentApiKeyInput) payload.payment_api_key = paymentApiKeyInput;
    if (paymentWebhookSecretInput)
      payload.payment_webhook_secret = paymentWebhookSecretInput;

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(payload),
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      paymentApiKeyInput = "";
      paymentWebhookSecretInput = "";
      saved = "payments";
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(serverSettings),
    });
    saving = false;
    if (res.ok) {
      serverSettings = await res.json();
      saved = "server";
      setTimeout(() => (saved = ""), 3000);
    } else {
      const d = await res.json();
      error = d.error ?? "Save failed";
    }
  }

  function set(key: string, value: string) {
    storeSettings = { ...storeSettings, [key]: value };
  }

  function val(key: string, fallback = "") {
    const v = storeSettings[key];
    if (v === undefined || v === null) return fallback;
    return String(v);
  }

  // Preset model lists per provider. Empty string = use provider default.
  const PROVIDER_MODELS: Record<string, Array<[string, string]>> = {
    claude: [
      ["", "Default (claude-sonnet-4-5)"],
      ["claude-opus-4-5", "claude-opus-4-5 — Most capable"],
      ["claude-sonnet-4-5", "claude-sonnet-4-5"],
      ["claude-haiku-4-5", "claude-haiku-4-5 — Fast"],
      ["claude-3-5-sonnet-20241022", "claude-3-5-sonnet-20241022 (Legacy)"],
      ["claude-3-haiku-20240307", "claude-3-haiku-20240307 (Legacy)"],
    ],
    gemini: [
      ["", "Default (gemini-1.5-flash)"],
      ["gemini-2.0-flash", "gemini-2.0-flash"],
      ["gemini-2.0-flash-lite", "gemini-2.0-flash-lite — Fast"],
      ["gemini-1.5-pro", "gemini-1.5-pro"],
      ["gemini-1.5-flash", "gemini-1.5-flash"],
    ],
    openai: [
      ["", "Default (gpt-4o-mini)"],
      ["gpt-4o", "gpt-4o"],
      ["gpt-4o-mini", "gpt-4o-mini — Fast"],
      ["o1", "o1"],
      ["o1-mini", "o1-mini"],
      ["gpt-4-turbo", "gpt-4-turbo (Legacy)"],
    ],
  };

  // When provider changes: clear the model and exit custom mode.
  function setProvider(pid: string) {
    set("ai_provider", pid);
    set("ai_model", "");
    customModelMode = false;
  }

  // True when the currently saved model is not a known preset (e.g. loaded from DB).
  function savedModelIsCustom(): boolean {
    const provider = val("ai_provider", "claude");
    const model = val("ai_model");
    if (!model) return false;
    const presets = PROVIDER_MODELS[provider] ?? [];
    return !presets.some(([v]) => v === model);
  }

  // State: whether we're showing the custom model text input.
  // Set to true when: the user picks "Custom…" from the dropdown, OR the loaded model
  // isn't in the preset list (e.g. a custom model name was saved previously).
  let customModelMode = $state(false);

  onMount(async () => {
    const t = token();
    if (t) {
      try {
        const payload = JSON.parse(atob(t.split(".")[1]));
        userRole = payload.role;
        currentUserId = payload.sub;

        // Default tab logic
        if (!activeStore.slug) activeTab = "server";
        else activeTab = "store";
      } catch (e) {
        console.error("Failed to parse token", e);
      }

      // Check if the current user still has the default password
      try {
        const authRes = await fetch("/api/auth", {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          needsPasswordChange = authData.needsPasswordChange === true;
        }
      } catch { /* non-critical */ }
    }
    loadStore();
    loadServer();
  });
</script>

<svelte:head><title>Settings — Prompt Commerce</title></svelte:head>

<div class="p-6 max-w-3xl">
  <h1 class="text-xl font-semibold text-gray-900 mb-1">Settings</h1>
  {#if activeStore.slug}
    <p class="text-sm text-gray-500 mb-6">
      Store: <span class="font-mono">{activeStore.slug}</span>
    </p>
  {:else}
    <p class="text-sm text-amber-600 mb-6">
      Select a store to manage store settings.
    </p>
  {/if}

  {#if needsPasswordChange}
    <div class="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div class="text-sm">
        <p class="font-semibold text-amber-800">You're using the default password</p>
        <p class="mt-0.5 text-amber-700">
          Please change your password before going live.
          Go to <button
            class="underline font-medium"
            onclick={() => { activeTab = 'users'; }}
          >Users → edit your account</button> to update it.
        </p>
      </div>
    </div>
  {/if}

  {#if error}
    <div
      class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
    >
      {error}
    </div>
  {/if}

  <!-- Tabs -->
  <div class="border-b border-gray-200 mb-6">
    <nav class="-mb-px flex gap-6">
      {#each visibleTabs() as [tab, label]}
        <button
          onclick={() => (activeTab = tab)}
          class="pb-3 text-sm font-medium border-b-2 transition-colors {activeTab ===
          tab
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >{label}</button
        >
      {/each}
    </nav>
  </div>

  <!-- ── Store Tab ──────────────────────────────────────────────────────────── -->
  {#if activeTab === "store"}
    {#if !activeStore.slug}
      <p class="text-sm text-gray-400">
        Select a store first to edit its settings.
      </p>
    {:else}
      <div class="space-y-5">
        <div>
          <label
            for="s-name"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Display Name</label
          >
          <input
            id="s-name"
            type="text"
            value={val("store_display_name")}
            oninput={(e) =>
              set("store_display_name", (e.target as HTMLInputElement).value)}
            placeholder="My Store"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">
            Shown to buyers in messages and order confirmations.
          </p>
        </div>
        <div>
          <label
            for="s-currency"
            class="block text-sm font-medium text-gray-700 mb-1">Currency</label
          >
          <input
            id="s-currency"
            type="text"
            value={val("store_currency", "PHP")}
            oninput={(e) =>
              set("store_currency", (e.target as HTMLInputElement).value)}
            placeholder="PHP"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">
            ISO 4217 currency code (e.g. PHP, USD, SGD).
          </p>
        </div>
        <div>
          <label for="s-tz" class="block text-sm font-medium text-gray-700 mb-1"
            >Timezone</label
          >
          <input
            id="s-tz"
            type="text"
            value={val("store_timezone", "Asia/Manila")}
            oninput={(e) =>
              set("store_timezone", (e.target as HTMLInputElement).value)}
            placeholder="Asia/Manila"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">
            IANA timezone for timestamps.
          </p>
        </div>
        <button
          onclick={() => saveStore()}
          disabled={saving}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {#if saving}Saving…{:else if saved === "store"}<Check
              class="w-4 h-4"
            /> Saved{:else}Save changes{/if}
        </button>
      </div>
    {/if}
  {/if}

  <!-- ── AI Tab ─────────────────────────────────────────────────────────────── -->
  {#if activeTab === "ai"}
    {#if !activeStore.slug}
      <p class="text-sm text-gray-400">Select a store first.</p>
    {:else}
      <div class="space-y-6">
        <!-- Provider selector -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">
            Active AI Provider
          </p>
          <div class="flex gap-3">
            {#each [["claude", "🤖 Claude"], ["gemini", "✨ Gemini"], ["openai", "⚫️ OpenAI"]] as [pid, label]}
              <button
                onclick={() => setProvider(pid)}
                class="flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors
                  {val('ai_provider', 'claude') === pid
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
                >{label}</button
              >
            {/each}
          </div>
          <p class="mt-1 text-xs text-gray-500">
            The Telegram bot will use this provider for AI chat responses.
          </p>
        </div>

        <!-- AI Model selector -->
        <div>
          <label
            for="ai-model"
            class="block text-sm font-medium text-gray-700 mb-1">Model</label
          >
          <!-- Preset dropdown — always visible; switches to custom text input when "Custom…" is chosen -->
          <select
            id="ai-model"
            value={customModelMode ? "__custom__" : val("ai_model")}
            onchange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              if (v === "__custom__") {
                customModelMode = true;
                // Leave ai_model as-is so the text input pre-fills with whatever was there
              } else {
                customModelMode = false;
                set("ai_model", v);
              }
            }}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 {customModelMode
              ? 'mb-2'
              : ''}"
          >
            {#each PROVIDER_MODELS[val("ai_provider", "claude")] ?? PROVIDER_MODELS.claude as [v, label]}
              <option value={v}>{label}</option>
            {/each}
            <option value="__custom__">Custom…</option>
          </select>
          {#if customModelMode}
            <input
              type="text"
              value={val("ai_model")}
              oninput={(e) =>
                set("ai_model", (e.target as HTMLInputElement).value)}
              placeholder="e.g. claude-3-5-sonnet-20241022"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              Type any model ID. Select a preset above to go back to the list.
            </p>
          {:else}
            <p class="mt-1 text-xs text-gray-500">
              Leave at "Default" to use the recommended model for the selected
              provider.
            </p>
          {/if}
        </div>

        <!-- Claude -->
        <div class="rounded-xl border border-gray-200 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center"
              >
                <span class="text-sm">🤖</span>
              </div>
              <span class="text-sm font-medium text-gray-800"
                >Anthropic Claude</span
              >
            </div>
            {#if storeSettings.claude_api_key_set}
              <span
                class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                >✓ Connected</span
              >
            {:else}
              <span
                class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"
                >Not connected</span
              >
            {/if}
          </div>
          <div>
            <label
              for="ai-claude"
              class="block text-xs font-medium text-gray-600 mb-1"
            >
              {storeSettings.claude_api_key_set ? "Replace API Key" : "API Key"}
            </label>
            <div class="relative">
              <input
                id="ai-claude"
                type={showClaudeKey ? "text" : "password"}
                bind:value={claudeKeyInput}
                placeholder={storeSettings.claude_api_key_set
                  ? "Paste new key to replace…"
                  : "sk-ant-…"}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onclick={() => (showClaudeKey = !showClaudeKey)}
                aria-label={showClaudeKey ? "Hide API key" : "Show API key"}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {#if showClaudeKey}<EyeOff class="w-4 h-4" />{:else}<Eye
                    class="w-4 h-4"
                  />{/if}
              </button>
            </div>
          </div>
        </div>

        <!-- Gemini -->
        <div class="rounded-xl border border-gray-200 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"
              >
                <span class="text-sm">✨</span>
              </div>
              <span class="text-sm font-medium text-gray-800"
                >Google Gemini</span
              >
            </div>
            {#if storeSettings.gemini_api_key_set}
              <span
                class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                >✓ Connected</span
              >
            {:else}
              <span
                class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"
                >Not connected</span
              >
            {/if}
          </div>
          <div>
            <label
              for="ai-gemini"
              class="block text-xs font-medium text-gray-600 mb-1"
            >
              {storeSettings.gemini_api_key_set ? "Replace API Key" : "API Key"}
            </label>
            <div class="relative">
              <input
                id="ai-gemini"
                type={showGeminiKey ? "text" : "password"}
                bind:value={geminiKeyInput}
                placeholder={storeSettings.gemini_api_key_set
                  ? "Paste new key to replace…"
                  : "AIza…"}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onclick={() => (showGeminiKey = !showGeminiKey)}
                aria-label={showGeminiKey ? "Hide API key" : "Show API key"}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {#if showGeminiKey}<EyeOff class="w-4 h-4" />{:else}<Eye
                    class="w-4 h-4"
                  />{/if}
              </button>
            </div>
          </div>
        </div>

        <!-- OpenAI -->
        <div class="rounded-xl border border-gray-200 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center"
              >
                <span class="text-sm">⚫️</span>
              </div>
              <span class="text-sm font-medium text-gray-800">OpenAI</span>
            </div>
            {#if storeSettings.openai_api_key_set}
              <span
                class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                >✓ Connected</span
              >
            {:else}
              <span
                class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"
                >Not connected</span
              >
            {/if}
          </div>
          <div>
            <label
              for="ai-openai"
              class="block text-xs font-medium text-gray-600 mb-1"
            >
              {storeSettings.openai_api_key_set ? "Replace API Key" : "API Key"}
            </label>
            <div class="relative">
              <input
                id="ai-openai"
                type={showOpenaiKey ? "text" : "password"}
                bind:value={openaiKeyInput}
                placeholder={storeSettings.openai_api_key_set
                  ? "Paste new key to replace…"
                  : "sk-…"}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onclick={() => (showOpenaiKey = !showOpenaiKey)}
                aria-label={showOpenaiKey ? "Hide API key" : "Show API key"}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {#if showOpenaiKey}<EyeOff class="w-4 h-4" />{:else}<Eye
                    class="w-4 h-4"
                  />{/if}
              </button>
            </div>
          </div>
        </div>

        <!-- Serper -->
        <div class="rounded-xl border border-gray-200 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center"
              >
                <span class="text-sm">🔍</span>
              </div>
              <span class="text-sm font-medium text-gray-800"
                >Serper (Web Search)</span
              >
            </div>
            {#if storeSettings.serper_api_key_set}
              <span
                class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                >✓ Connected</span
              >
            {:else}
              <span
                class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"
                >Not connected</span
              >
            {/if}
          </div>
          <div>
            <label
              for="ai-serper"
              class="block text-xs font-medium text-gray-600 mb-1"
            >
              {storeSettings.serper_api_key_set ? "Replace API Key" : "API Key"}
            </label>
            <div class="relative">
              <input
                id="ai-serper"
                type={showSerperKey ? "text" : "password"}
                bind:value={serperKeyInput}
                placeholder={storeSettings.serper_api_key_set
                  ? "Paste new key to replace…"
                  : "..."}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onclick={() => (showSerperKey = !showSerperKey)}
                aria-label={showSerperKey ? "Hide API key" : "Show API key"}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {#if showSerperKey}<EyeOff class="w-4 h-4" />{:else}<Eye
                    class="w-4 h-4"
                  />{/if}
              </button>
            </div>
          </div>
        </div>

        <!-- AI System Prompt -->
        <div class="mt-4">
          <label
            for="ai-prompt"
            class="block text-sm font-medium text-gray-700 mb-1"
            >System Prompt Override</label
          >
          <textarea
            id="ai-prompt"
            rows="4"
            value={val("ai_system_prompt")}
            oninput={(e) =>
              set("ai_system_prompt", (e.target as HTMLTextAreaElement).value)}
            placeholder="You are a helpful sales assistant for..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          ></textarea>
          <p class="mt-1 text-xs text-gray-500">
            Define the AI's personality and knowledge about your store.
          </p>
        </div>
        <div class="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-4">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Lock class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-sm font-medium text-indigo-900">Temporary LLM Client Access</h3>
              <p class="text-xs text-indigo-700">Generate an expiring key for Claude Desktop or other external LLMs.</p>
            </div>
          </div>

          {#if tempMcpKey}
            <div class="space-y-3">
              <div class="relative">
                <input
                  type="text"
                  readonly
                  value={tempMcpKey}
                  class="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-mono text-indigo-900 pr-10"
                />
                <button 
                  onclick={() => { navigator.clipboard.writeText(tempMcpKey); alerted = "Copied!"; setTimeout(() => alerted="", 2000); }}
                  aria-label="Copy to clipboard"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-400 hover:text-indigo-600"
                  title="Copy to clipboard"
                >
                  <Check class={alerted ? "w-4 h-4 text-green-500" : "w-4 h-4"} />
                </button>
              </div>
              <div class="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-indigo-500">
                <span>Expires: {new Date(tempMcpExpiry).toLocaleString()}</span>
                {#if alerted}<span class="text-green-600">{alerted}</span>{/if}
              </div>
              <p class="text-xs text-indigo-600 leading-relaxed">
                Use this as the <code class="bg-indigo-100 px-1 rounded">x-gateway-key</code> in your client.
                It will expire automatically and only grants access to this session's stores.
              </p>
            </div>
          {:else}
            <div class="flex items-center gap-3">
              <select 
                bind:value={tempKeyDuration}
                class="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={60}>1 Hour</option>
                <option value={240}>4 Hours</option>
                <option value={480}>8 Hours</option>
                <option value={1440}>24 Hours</option>
              </select>
              <button
                onclick={generateMcpKey}
                disabled={tempKeyLoading}
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {tempKeyLoading ? 'Generating...' : 'Generate Temp Key'}
              </button>
            </div>
          {/if}
        </div>

        <div class="flex items-center justify-between pt-4 border-t">
          <div class="flex items-center gap-3">
            <button
              onclick={() => saveAi()}
              disabled={saving}
              class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {#if saving}Saving…{:else if saved === "ai"}<Check
                  class="w-4 h-4"
                /> Saved{:else}Save AI settings{/if}
            </button>

            <!-- Sync Status Badge -->
            {#if aiGatewayStatus === "synced"}
              <div
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-100"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <span class="text-xs font-medium">Synced to gateway</span>
              </div>
            {:else if aiGatewayStatus === "failed"}
              <div
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-100"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <span class="text-xs font-medium"
                  >Gateway error: {aiGatewayReason}</span
                >
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ── Telegram Tab ───────────────────────────────────────────────────────── -->
  {#if activeTab === "telegram"}
    {#if !activeStore.slug}
      <p class="text-sm text-gray-400">Select a store first.</p>
    {:else}
      <div class="space-y-5">
        <div>
          <label
            for="t-token"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Bot Token</label
          >
          <div class="relative">
            <input
              id="t-token"
              type={showTelegramKey ? "text" : "password"}
              bind:value={telegramKeyInput}
              placeholder={storeSettings.telegram_bot_token_set
                ? "••••••••••••••••••••••••••••"
                : "123456789:ABCDefgh..."}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onclick={() => (showTelegramKey = !showTelegramKey)}
              aria-label={showTelegramKey ? "Hide token" : "Show token"}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {#if showTelegramKey}<EyeOff class="w-4 h-4" />{:else}<Eye
                  class="w-4 h-4"
                />{/if}
            </button>
          </div>
          <p class="mt-1 text-xs text-gray-500">
            From <a
              href="https://t.me/BotFather"
              target="_blank"
              class="text-indigo-600 hover:underline">@BotFather</a
            >.
          </p>
        </div>

        <div>
          <label
            for="t-webhook"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Webhook URL (Optional)</label
          >
          <input
            id="t-webhook"
            type="text"
            value={val("telegram_webhook_url")}
            oninput={(e) =>
              set("telegram_webhook_url", (e.target as HTMLInputElement).value)}
            placeholder="https://..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">
            If empty, gateway uses long-polling. Use HTTPS for webhooks.
          </p>
        </div>

        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div>
            <h4 class="text-sm font-medium text-gray-800 mb-0.5">Order Notifications</h4>
            <p class="text-xs text-gray-500">
              Receive a Telegram message whenever a buyer places an order in this store.
            </p>
          </div>
          <div>
            <label
              for="t-notify-id"
              class="block text-xs font-medium text-gray-700 mb-1"
              >Your Telegram Chat ID</label
            >
            <input
              id="t-notify-id"
              type="text"
              value={val("telegram_notify_chat_id")}
              oninput={(e) =>
                set("telegram_notify_chat_id", (e.target as HTMLInputElement).value)}
              placeholder="e.g. 123456789"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              Send <code class="bg-gray-100 px-1 rounded">/myid</code> to your Telegram bot to get this number.
            </p>
          </div>
        </div>

        <button
          onclick={() => saveTelegram()}
          disabled={saving}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {#if saving}Saving…{:else if saved === "telegram"}<Check
              class="w-4 h-4"
            /> Saved{:else}Save Telegram settings{/if}
        </button>
      </div>
    {/if}
  {/if}

  <!-- ── Payments Tab ───────────────────────────────────────────────────────── -->
  {#if activeTab === "payments"}
    {#if !activeStore.slug}
      <p class="text-sm text-gray-400">Select a store first.</p>
    {:else}
      <div class="space-y-6">
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">Provider</p>
          <div class="flex gap-3">
            {#each [["mock", "📦 Mock"], ["paymongo", "🇵🇭 PayMongo"], ["stripe", "🌍 Stripe"]] as [pid, label]}
              <button
                onclick={() => set("payment_provider", pid)}
                class="flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors
                  {val('payment_provider', 'mock') === pid
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
                >{label}</button
              >
            {/each}
          </div>
        </div>

        {#if val("payment_provider") !== "mock"}
          <div>
            <label
              for="p-api"
              class="block text-sm font-medium text-gray-700 mb-1"
            >
              {val("payment_provider") === "paymongo"
                ? "Secret Key"
                : "Secret Key"}
            </label>
            <div class="relative">
              <input
                id="p-api"
                type={showPaymentApiKey ? "text" : "password"}
                bind:value={paymentApiKeyInput}
                placeholder={storeSettings.payment_api_key_set
                  ? "••••••••••••••••••••••••••••"
                  : "sk_test_..."}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onclick={() => (showPaymentApiKey = !showPaymentApiKey)}
                aria-label={showPaymentApiKey ? "Hide API key" : "Show API key"}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {#if showPaymentApiKey}<EyeOff class="w-4 h-4" />{:else}<Eye
                    class="w-4 h-4"
                  />{/if}
              </button>
            </div>
          </div>

          <div>
            <label
              for="p-pub"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Public Key</label
            >
            <input
              id="p-pub"
              type="text"
              value={val("payment_public_key")}
              oninput={(e) =>
                set("payment_public_key", (e.target as HTMLInputElement).value)}
              placeholder="pk_test_..."
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              for="p-web"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Webhook Secret</label
            >
            <div class="relative">
              <input
                id="p-web"
                type={showPaymentWebhookSecret ? "text" : "password"}
                bind:value={paymentWebhookSecretInput}
                placeholder={storeSettings.payment_webhook_secret_set
                  ? "••••••••••••••••••••••••••••"
                  : "whsec_..."}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onclick={() =>
                  (showPaymentWebhookSecret = !showPaymentWebhookSecret)}
                aria-label={showPaymentWebhookSecret ? "Hide secret" : "Show secret"}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {#if showPaymentWebhookSecret}<EyeOff
                    class="w-4 h-4"
                  />{:else}<Eye class="w-4 h-4" />{/if}
              </button>
            </div>
            <p class="mt-2 text-xs text-gray-500">
              Register this webhook URL in your {val("payment_provider") ===
              "paymongo"
                ? "PayMongo"
                : "Stripe"} dashboard:
              <code class="block mt-1 p-2 bg-gray-50 rounded border"
                >https://your-gateway.com/webhooks/payment/{activeStore.slug}</code
              >
            </p>
          </div>
        {/if}

        <button
          onclick={() => savePayments()}
          disabled={saving}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {#if saving}Saving…{:else if saved === "payments"}<Check
              class="w-4 h-4"
            /> Saved{:else}Save payment settings{/if}
        </button>
      </div>
    {/if}
  {/if}

  <!-- ── Users Tab ──────────────────────────────────────────────────────────── -->
  {#if activeTab === "users"}
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-gray-900">
          {activeStore.slug ? "Store Users" : "Server Users"}
        </h2>
        <button
          onclick={() => (showAddUserModal = true)}
          class="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <UserRoundPlus class="w-4 h-4 mr-2" /> Add User
        </button>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >User</th
              >
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >Name</th
              >
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >Email</th
              >
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >Role</th
              >
              <th
                class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >Actions</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            {#each usersList as user}
              <tr>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-medium"
                    >
                      {user.username[0].toUpperCase()}
                    </div>
                    <span class="text-sm text-gray-900">{user.username}</span>
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{user.first_name} {user.last_name}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="text-sm text-gray-500">{user.email}</div>
                  {#if user.mobile}
                    <div class="text-[10px] text-gray-400">{user.mobile}</div>
                  {/if}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                    {user.role === 'super_admin'
                      ? 'bg-purple-50 text-purple-700'
                      : user.role === 'admin'
                        ? 'bg-blue-50 text-blue-700'
                        : user.role === 'store_admin'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-teal-50 text-teal-700'}"
                  >
                    {user.role.replace("_", " ")}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      onclick={() => openEditModal(user)}
                      class="text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Edit User"
                    >
                      <Pencil class="w-4 h-4" />
                    </button>
                    {#if user.id !== currentUserId}
                      <button
                        onclick={() => deleteUser(user.id)}
                        class="text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add User Modal -->
    {#if showAddUserModal}
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-all p-4"
        onclick={(e) => {
          if (e.target === e.currentTarget) showAddUserModal = false;
        }}
        onkeydown={(e) => {
          if (e.key === "Escape") showAddUserModal = false;
        }}
        role="button"
        tabindex="0"
      >
        <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Add New User</h3>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="n-fname" class="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                <input id="n-fname" type="text" bind:value={newUserFirstName} class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label for="n-lname" class="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                <input id="n-lname" type="text" bind:value={newUserLastName} class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="n-user" class="block text-xs font-medium text-gray-500 mb-1">Username</label>
                <input id="n-user" type="text" bind:value={newUserName} placeholder="johndoe" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label for="n-pass" class="block text-xs font-medium text-gray-500 mb-1">Password</label>
                <input id="n-pass" type="password" bind:value={newUserPass} placeholder="••••••••" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="n-email" class="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input id="n-email" type="email" bind:value={newUserEmail} placeholder="john@example.com" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label for="n-mobile" class="block text-xs font-medium text-gray-500 mb-1">Mobile (Optional)</label>
                <input id="n-mobile" type="text" bind:value={newUserMobile} placeholder="+1..." class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div>
              <label
                for="n-role"
                class="block text-xs font-medium text-gray-500 mb-1">Role</label
              >
              <select
                id="n-role"
                bind:value={newUserRole}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {#if !activeStore.slug}
                  <option value="admin">Global Admin</option>
                  <option value="super_admin">Super Admin</option>
                {:else}
                  <option value="store_admin">Store Admin</option>
                  <option value="merchandising">Merchandising</option>
                  <option value="ops">Operations</option>
                {/if}
              </select>
            </div>
            <div class="flex gap-3 pt-2">
              <button
                onclick={() => (showAddUserModal = false)}
                class="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onclick={addUser}
                disabled={saving || !newUserName || !newUserPass || !newUserFirstName || !newUserLastName || !newUserEmail}
                class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Edit User Modal -->
    {#if showEditUserModal && editingUser}
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-all p-4"
        onclick={(e) => {
          if (e.target === e.currentTarget) showEditUserModal = false;
        }}
        onkeydown={(e) => {
          if (e.key === "Escape") showEditUserModal = false;
        }}
        role="button"
        tabindex="0"
      >
        <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Edit User</h3>
            <span class="text-xs text-gray-400 font-mono">ID: {editingUser.id}</span>
          </div>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="e-fname" class="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                <input id="e-fname" type="text" bind:value={editingUser.first_name} class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label for="e-lname" class="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                <input id="e-lname" type="text" bind:value={editingUser.last_name} class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="e-user" class="block text-xs font-medium text-gray-500 mb-1">Username</label>
                <input id="e-user" type="text" bind:value={editingUser.username} class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label for="e-pass" class="block text-xs font-medium text-gray-500 mb-1">New Password (optional)</label>
                <input id="e-pass" type="password" bind:value={editingUser.newPassword} placeholder="Leave blank to keep current" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="e-email" class="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input id="e-email" type="email" bind:value={editingUser.email} class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label for="e-mobile" class="block text-xs font-medium text-gray-500 mb-1">Mobile (Optional)</label>
                <input id="e-mobile" type="text" bind:value={editingUser.mobile} class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div>
              <label
                for="e-role"
                class="block text-xs font-medium text-gray-500 mb-1">Role</label
              >
              <select
                id="e-role"
                bind:value={editingUser.role}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {#if !activeStore.slug}
                  <option value="admin">Global Admin</option>
                  <option value="super_admin">Super Admin</option>
                {:else}
                  <option value="store_admin">Store Admin</option>
                  <option value="merchandising">Merchandising</option>
                  <option value="ops">Operations</option>
                {/if}
              </select>
            </div>
            <div class="flex gap-3 pt-2">
              <button
                onclick={() => { showEditUserModal = false; editingUser = null; }}
                class="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onclick={updateUser}
                disabled={saving || !editingUser.username || !editingUser.first_name || !editingUser.last_name || !editingUser.email}
                class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Updating..." : "Update User"}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ── Server Tab ─────────────────────────────────────────────────────────── -->
  {#if activeTab === "server"}
    <div class="space-y-6">
      <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div class="flex items-center gap-3 mb-4">
          <div
            class="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center border border-gray-100"
          >
            <Shield class="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-gray-900">Global Admin</h3>
            <p class="text-xs text-gray-500">
              Only visible to Super Admins and server-level Administrators.
            </p>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label
              for="v-url"
              class="block text-xs font-medium text-gray-700 mb-1"
              >Gateway URL</label
            >
            <input
              id="v-url"
              type="text"
              bind:value={serverSettings.gateway_url}
              placeholder="http://localhost:3002"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              Internal address of the Prompt Commerce Gateway service. Can also be set via <code class="bg-gray-100 px-1 rounded">GATEWAY_URL</code> in <code class="bg-gray-100 px-1 rounded">seller.config.json</code>.
            </p>
          </div>

          <div>
            <label
              for="v-public-url"
              class="block text-xs font-medium text-gray-700 mb-1"
              >Seller Public URL</label
            >
            <input
              id="v-public-url"
              type="text"
              bind:value={serverSettings.seller_public_url}
              placeholder="https://shop.example.com  (auto-detected when blank)"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p class="mt-1 text-xs text-gray-500">
              The public web address of this store. Used to build absolute product image URLs for Telegram and other integrations. Leave blank for local development — it will be detected automatically. Can also be set via <code class="bg-gray-100 px-1 rounded">sellerPublicUrl</code> in <code class="bg-gray-100 px-1 rounded">seller.config.json</code>.
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 p-4">
        <div class="flex items-center gap-2 mb-4 text-gray-900">
          <Lock class="w-4 h-4 text-gray-400" />
          <h3 class="text-sm font-medium">Security Policies</h3>
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-700">Audit Logging</p>
              <p class="text-xs text-gray-500">
                Record all administrative actions to log files.
              </p>
            </div>
            <button
              onclick={() =>
                (serverSettings.audit_logging =
                  serverSettings.audit_logging === "1" ? "0" : "1")}
              aria-label="Toggle audit logging"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {serverSettings.audit_logging ===
              '1'
                ? 'bg-indigo-600'
                : 'bg-gray-200'}"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {serverSettings.audit_logging ===
                '1'
                  ? 'translate-x-6'
                  : 'translate-x-1'}"
              ></span>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-700">Debug Mode</p>
              <p class="text-xs text-gray-500">Show detailed error messages.</p>
            </div>
            <button
              onclick={() =>
                (serverSettings.debug_mode =
                  serverSettings.debug_mode === "1" ? "0" : "1")}
              aria-label="Toggle debug mode"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {serverSettings.debug_mode ===
              '1'
                ? 'bg-indigo-600'
                : 'bg-gray-200'}"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {serverSettings.debug_mode ===
                '1'
                  ? 'translate-x-6'
                  : 'translate-x-1'}"
              ></span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2">
        <button
          onclick={() => saveServer()}
          disabled={saving ||
            (userRole !== "super_admin" && userRole !== "admin")}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {#if saving}Saving…{:else if saved === "server"}<Check
              class="w-4 h-4"
            /> Saved{:else}Save Server Settings{/if}
        </button>

        {#if userRole === "super_admin" || userRole === "admin"}
          <div
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100"
          >
            <UserRoundCog class="w-3.5 h-3.5 mr-1" />
            <span class="text-xs font-medium"
              >Authorized as {userRole.replace("_", " ")}</span
            >
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.backdrop-blur-sm) {
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
  }
</style>
