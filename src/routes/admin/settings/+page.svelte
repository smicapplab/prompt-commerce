<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';
  import { Eye, EyeOff, Check } from 'lucide-svelte';

  // Per-store settings (require a store to be selected)
  let storeSettings = $state<Record<string, string | boolean>>({});
  // Server settings (always available)
  let serverSettings = $state<Record<string, string>>({});

  let saving = $state(false);
  let saved  = $state('');   // key of tab that just saved
  let error  = $state('');
  let activeTab = $state<'store' | 'ai' | 'telegram' | 'server'>('store');

  let showClaudeKey   = $state(false);
  let showGeminiKey   = $state(false);
  let showSerperKey   = $state(false);
  let showTelegramKey = $state(false);

  // Inputs for sensitive fields (not in storeSettings since server masks them)
  let claudeKeyInput   = $state('');
  let geminiKeyInput   = $state('');
  let serperKeyInput   = $state('');
  let telegramKeyInput = $state('');

  const token = () => localStorage.getItem('pc_token') ?? '';

  async function loadStore() {
    if (!activeStore.slug) return;
    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    if (res.ok) storeSettings = await res.json();
  }

  async function loadServer() {
    const res = await fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token()}` }
    });
    if (res.ok) serverSettings = await res.json();
  }

  async function saveStore(extra: Record<string, string> = {}) {
    if (!activeStore.slug) return;
    saving = true; saved = ''; error = '';
    const payload: Record<string, string> = { ...extra };

    // Collect display fields
    payload.store_display_name = String(storeSettings.store_display_name ?? '');
    payload.store_currency     = String(storeSettings.store_currency ?? '');
    payload.store_timezone     = String(storeSettings.store_timezone ?? '');

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload)
    });
    saving = false;
    if (res.ok) { storeSettings = await res.json(); saved = 'store'; setTimeout(() => (saved = ''), 3000); }
    else { const d = await res.json(); error = d.error ?? 'Save failed'; }
  }

  async function saveAi() {
    if (!activeStore.slug) return;
    saving = true; saved = ''; error = '';
    const payload: Record<string, string> = {};
    if (claudeKeyInput)   payload.claude_api_key   = claudeKeyInput;
    if (geminiKeyInput)   payload.gemini_api_key   = geminiKeyInput;
    if (serperKeyInput)   payload.serper_api_key   = serperKeyInput;
    payload.ai_enabled      = String(storeSettings.ai_enabled ?? '0');
    payload.ai_model        = String(storeSettings.ai_model ?? '');
    payload.ai_system_prompt = String(storeSettings.ai_system_prompt ?? '');

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload)
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      claudeKeyInput = ''; geminiKeyInput = ''; serperKeyInput = '';
      saved = 'ai'; setTimeout(() => (saved = ''), 3000);
    } else { const d = await res.json(); error = d.error ?? 'Save failed'; }
  }

  async function saveTelegram() {
    if (!activeStore.slug) return;
    saving = true; saved = ''; error = '';
    const payload: Record<string, string> = {
      telegram_webhook_url: String(storeSettings.telegram_webhook_url ?? ''),
    };
    if (telegramKeyInput) payload.telegram_bot_token = telegramKeyInput;

    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload)
    });
    saving = false;
    if (res.ok) {
      storeSettings = await res.json();
      telegramKeyInput = '';
      saved = 'telegram'; setTimeout(() => (saved = ''), 3000);
    } else { const d = await res.json(); error = d.error ?? 'Save failed'; }
  }

  async function saveServer() {
    saving = true; saved = ''; error = '';
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(serverSettings)
    });
    saving = false;
    if (res.ok) { serverSettings = await res.json(); saved = 'server'; setTimeout(() => (saved = ''), 3000); }
    else { const d = await res.json(); error = d.error ?? 'Save failed'; }
  }

  function set(key: string, value: string) {
    storeSettings = { ...storeSettings, [key]: value };
  }

  function val(key: string, fallback = '') {
    const v = storeSettings[key];
    if (v === undefined || v === null) return fallback;
    return String(v);
  }

  onMount(() => { loadStore(); loadServer(); });
</script>

<svelte:head><title>Settings — Prompt Commerce</title></svelte:head>

<div class="p-6 max-w-3xl">
  <h1 class="text-xl font-semibold text-gray-900 mb-1">Settings</h1>
  {#if activeStore.slug}
    <p class="text-sm text-gray-500 mb-6">Store: <span class="font-mono">{activeStore.slug}</span></p>
  {:else}
    <p class="text-sm text-amber-600 mb-6">Select a store to manage store settings.</p>
  {/if}

  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
  {/if}

  <!-- Tabs -->
  <div class="border-b border-gray-200 mb-6">
    <nav class="-mb-px flex gap-6">
      {#each [['store','Store'],['ai','AI / LLM'],['telegram','Telegram'],['server','Server']] as [tab, label]}
        <button
          onclick={() => (activeTab = tab as any)}
          class="pb-3 text-sm font-medium border-b-2 transition-colors {activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
        >{label}</button>
      {/each}
    </nav>
  </div>

  <!-- ── Store Tab ──────────────────────────────────────────────────────────── -->
  {#if activeTab === 'store'}
    {#if !activeStore.slug}
      <p class="text-sm text-gray-400">Select a store first to edit its settings.</p>
    {:else}
      <div class="space-y-5">
        <div>
          <label for="s-name" class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input id="s-name" type="text"
            value={val('store_display_name')}
            oninput={(e) => set('store_display_name', (e.target as HTMLInputElement).value)}
            placeholder="My Store"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">Shown to buyers in messages and order confirmations.</p>
        </div>
        <div>
          <label for="s-currency" class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <input id="s-currency" type="text"
            value={val('store_currency', 'PHP')}
            oninput={(e) => set('store_currency', (e.target as HTMLInputElement).value)}
            placeholder="PHP"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">ISO 4217 currency code (e.g. PHP, USD, SGD).</p>
        </div>
        <div>
          <label for="s-tz" class="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <input id="s-tz" type="text"
            value={val('store_timezone', 'Asia/Manila')}
            oninput={(e) => set('store_timezone', (e.target as HTMLInputElement).value)}
            placeholder="Asia/Manila"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">IANA timezone for timestamps.</p>
        </div>
        <button onclick={() => saveStore()} disabled={saving}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {#if saving}Saving…{:else if saved === 'store'}<Check class="w-4 h-4" /> Saved{:else}Save changes{/if}
        </button>
      </div>
    {/if}
  {/if}

  <!-- ── AI Tab ─────────────────────────────────────────────────────────────── -->
  {#if activeTab === 'ai'}
    {#if !activeStore.slug}
      <p class="text-sm text-gray-400">Select a store first.</p>
    {:else}
      <div class="space-y-6">

        <!-- Claude -->
        <div class="rounded-xl border border-gray-200 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <span class="text-sm">🤖</span>
              </div>
              <span class="text-sm font-medium text-gray-800">Anthropic Claude</span>
            </div>
            {#if storeSettings.claude_api_key_set}
              <span class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Connected</span>
            {:else}
              <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not connected</span>
            {/if}
          </div>
          <div>
            <label for="ai-claude" class="block text-xs font-medium text-gray-600 mb-1">
              {storeSettings.claude_api_key_set ? 'Replace API Key' : 'API Key'}
            </label>
            <div class="relative">
              <input id="ai-claude"
                type={showClaudeKey ? 'text' : 'password'}
                bind:value={claudeKeyInput}
                placeholder={storeSettings.claude_api_key_set ? 'Paste new key to replace…' : 'sk-ant-…'}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="button" onclick={() => (showClaudeKey = !showClaudeKey)}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {#if showClaudeKey}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
              </button>
            </div>
          </div>
        </div>

        <!-- Gemini -->
        <div class="rounded-xl border border-gray-200 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <span class="text-sm">✨</span>
              </div>
              <span class="text-sm font-medium text-gray-800">Google Gemini</span>
            </div>
            {#if storeSettings.gemini_api_key_set}
              <span class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Connected</span>
            {:else}
              <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not connected</span>
            {/if}
          </div>
          <div>
            <label for="ai-gemini" class="block text-xs font-medium text-gray-600 mb-1">
              {storeSettings.gemini_api_key_set ? 'Replace API Key' : 'API Key'}
            </label>
            <div class="relative">
              <input id="ai-gemini"
                type={showGeminiKey ? 'text' : 'password'}
                bind:value={geminiKeyInput}
                placeholder={storeSettings.gemini_api_key_set ? 'Paste new key to replace…' : 'AIza…'}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="button" onclick={() => (showGeminiKey = !showGeminiKey)}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {#if showGeminiKey}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
              </button>
            </div>
          </div>
        </div>

        <!-- Serper -->
        <div class="rounded-xl border border-gray-200 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                <span class="text-sm">🔍</span>
              </div>
              <span class="text-sm font-medium text-gray-800">Serper (Web Search)</span>
            </div>
            {#if storeSettings.serper_api_key_set}
              <span class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Connected</span>
            {:else}
              <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
            {/if}
          </div>
          <div>
            <label for="ai-serper" class="block text-xs font-medium text-gray-600 mb-1">API Key</label>
            <div class="relative">
              <input id="ai-serper"
                type={showSerperKey ? 'text' : 'password'}
                bind:value={serperKeyInput}
                placeholder={storeSettings.serper_api_key_set ? 'Paste new key to replace…' : 'Serper API key…'}
                class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="button" onclick={() => (showSerperKey = !showSerperKey)}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {#if showSerperKey}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
              </button>
            </div>
          </div>
        </div>

        <!-- AI behaviour -->
        <div class="space-y-4">
          <div class="flex items-center justify-between p-4 rounded-lg border border-gray-200">
            <div>
              <p class="text-sm font-medium text-gray-700">Enable AI responses</p>
              <p class="text-xs text-gray-500 mt-0.5">AI handles buyer questions; escalates when needed.</p>
            </div>
            <button
              onclick={() => set('ai_enabled', val('ai_enabled') === '1' ? '0' : '1')}
              aria-label={val('ai_enabled') === '1' ? 'Disable AI responses' : 'Enable AI responses'}
              aria-pressed={val('ai_enabled') === '1'}
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {val('ai_enabled') === '1' ? 'bg-indigo-600' : 'bg-gray-200'}"
            >
              <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {val('ai_enabled') === '1' ? 'translate-x-6' : 'translate-x-1'}"></span>
            </button>
          </div>
          <div>
            <label for="ai-prompt" class="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea id="ai-prompt"
              value={val('ai_system_prompt', 'You are a helpful store assistant. Answer questions about products. If unsure, say you will connect the buyer with a staff member.')}
              oninput={(e) => set('ai_system_prompt', (e.target as HTMLTextAreaElement).value)}
              rows={4}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            ></textarea>
          </div>
        </div>

        <button onclick={saveAi} disabled={saving}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {#if saving}Saving…{:else if saved === 'ai'}<Check class="w-4 h-4" /> Saved{:else}Save AI settings{/if}
        </button>
      </div>
    {/if}
  {/if}

  <!-- ── Telegram Tab ────────────────────────────────────────────────────────── -->
  {#if activeTab === 'telegram'}
    {#if !activeStore.slug}
      <p class="text-sm text-gray-400">Select a store first.</p>
    {:else}
      <div class="space-y-5">
        <div class="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          Create a bot via <a href="https://t.me/BotFather" target="_blank" class="underline font-medium">@BotFather</a> on Telegram, then paste the token below.
        </div>
        <div>
          <label for="tg-token" class="block text-sm font-medium text-gray-700 mb-1">Bot Token</label>
          <div class="relative">
            <input id="tg-token"
              type={showTelegramKey ? 'text' : 'password'}
              bind:value={telegramKeyInput}
              placeholder={storeSettings.telegram_bot_token_set ? 'Paste new token to replace…' : '123456:ABC-DEF…'}
              class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="button" onclick={() => (showTelegramKey = !showTelegramKey)}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {#if showTelegramKey}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
            </button>
          </div>
          {#if storeSettings.telegram_bot_token_set}
            <p class="text-xs text-green-600 mt-1">✓ Token saved</p>
          {/if}
        </div>
        <div>
          <label for="tg-webhook" class="block text-sm font-medium text-gray-700 mb-1">Webhook URL <span class="text-gray-400 font-normal">(auto-managed)</span></label>
          <input id="tg-webhook" type="url"
            value={val('telegram_webhook_url')}
            oninput={(e) => set('telegram_webhook_url', (e.target as HTMLInputElement).value)}
            placeholder="https://gateway.example.com/telegram/webhook"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">Leave blank — the gateway registers the webhook automatically.</p>
        </div>
        <button onclick={saveTelegram} disabled={saving}
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {#if saving}Saving…{:else if saved === 'telegram'}<Check class="w-4 h-4" /> Saved{:else}Save Telegram settings{/if}
        </button>
      </div>
    {/if}
  {/if}

  <!-- ── Server Tab ─────────────────────────────────────────────────────────── -->
  {#if activeTab === 'server'}
    <div class="space-y-5">
      <div class="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
        These settings apply to the entire server, not a specific store.
      </div>
      <div>
        <label for="srv-gw" class="block text-sm font-medium text-gray-700 mb-1">Gateway URL</label>
        <input id="srv-gw" type="url"
          value={serverSettings.gateway_url ?? ''}
          oninput={(e) => (serverSettings = { ...serverSettings, gateway_url: (e.target as HTMLInputElement).value })}
          placeholder="http://localhost:3002"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p class="mt-1 text-xs text-gray-500">Used by the seller app to look up store details by key.</p>
      </div>
      <button onclick={saveServer} disabled={saving}
        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {#if saving}Saving…{:else if saved === 'server'}<Check class="w-4 h-4" /> Saved{:else}Save server settings{/if}
      </button>
    </div>
  {/if}
</div>
