<script lang="ts">
  import {
    Check,
    Eye,
    EyeOff,
    MessageCircle,
    Send,
    Info,
    ExternalLink,
    Bot,
    Smartphone,
    BellRing,
    RefreshCw,
    AlertCircle,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { fade } from "svelte/transition";

  // Internal state
  let data = $state<Record<string, string | boolean>>({});
  let serverSettings = $state<Record<string, string>>({});
  let loading = $state(false);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state("");

  // Telegram specific
  let telegramMode = $state<"polling" | "webhook">("polling");
  let telegramCustomUrl = $state("");
  let telegramKeyInput = $state("");
  let showTelegramKey = $state(false);
  let telegramWebhookUrlCopied = $state(false);

  let telegramBotStatus = $state<"idle" | "checking" | "active" | "failed">(
    "idle",
  );
  let telegramBotStatusInfo = $state<any>(null);
  let whatsappStatus = $state<"active" | "failed">("failed");

  const token = () => localStorage.getItem("pc_token") ?? "";

  function val(key: string, fallback = ""): string {
    return String(data[key] ?? fallback);
  }

  const defaultTelegramWebhookUrl = $derived(
    serverSettings.gateway_url && activeStore.slug
      ? `${serverSettings.gateway_url.replace(/\/$/, "")}/webhooks/telegram/${activeStore.slug}`
      : "",
  );

  $effect(() => {
    if (activeStore.slug) load();
  });

  async function load() {
    if (!activeStore.slug) return;
    loading = true;
    error = "";
    try {
      // Load server settings first for gateway_url
      const srvRes = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (srvRes.ok) {
        serverSettings = await srvRes.json();
        whatsappStatus = serverSettings.whatsapp_configured
          ? "active"
          : "failed";
      }

      // Load store settings
      const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        data = await res.json();
        telegramMode = val("telegram_webhook_url") ? "webhook" : "polling";
        telegramCustomUrl =
          val("telegram_webhook_url") === defaultTelegramWebhookUrl
            ? ""
            : val("telegram_webhook_url");
        checkBotStatus();
      }
    } catch (e) {
      error = "Load failed";
    } finally {
      loading = false;
    }
  }

  async function checkBotStatus() {
    if (!activeStore.slug) return;
    telegramBotStatus = "checking";
    try {
      const res = await fetch(
        `/api/settings/telegram-bot-status?store=${activeStore.slug}`,
        {
          headers: { Authorization: `Bearer ${token()}` },
        },
      );
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

  async function saveMessaging() {
    if (!activeStore.slug) return;
    saving = true;
    saved = false;
    error = "";

    const webhookUrl =
      telegramMode === "webhook"
        ? telegramCustomUrl.trim() || defaultTelegramWebhookUrl || null
        : null;
    const payload: Record<string, string | null> = {
      telegram_enabled: val("telegram_enabled", "0"),
      whatsapp_enabled: val("whatsapp_enabled", "0"),
      telegram_webhook_url: webhookUrl,
      telegram_notify_chat_id: String(data.telegram_notify_chat_id ?? ""),
      whatsapp_notify_number: String(data.whatsapp_notify_number ?? ""),
    };
    if (telegramKeyInput) payload.telegram_bot_token = telegramKeyInput.trim();

    try {
      const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        data = await res.json();
        telegramKeyInput = "";
        saved = true;
        checkBotStatus();
        setTimeout(() => (saved = false), 3000);
      } else {
        const d = await res.json();
        error = d.error ?? "Save failed";
      }
    } catch (e) {
      error = "Connection error";
    } finally {
      saving = false;
    }
  }
</script>

{#if !activeStore.slug}
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div
      class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4"
    >
      <MessageCircle size={32} />
    </div>
    <h3 class="text-lg font-medium text-gray-900">No Store Selected</h3>
    <p class="text-sm text-gray-500 max-w-xs mt-1">
      Select a store from the sidebar to configure its messaging channels.
    </p>
  </div>
{:else if loading && !data.telegram_enabled}
  <div class="flex items-center justify-center py-20">
    <RefreshCw size={32} class="animate-spin text-gray-300" />
  </div>
{:else}
  <div class="space-y-8 animate-in fade-in duration-500 pb-20">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 tracking-tight">
        Messaging Channels
      </h2>
      <p class="text-sm text-gray-500 mt-1">
        Configure how your AI interacts with customers on Telegram and WhatsApp.
      </p>
    </div>

    {#if error}
      <div
        class="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700 shadow-sm"
      >
        <AlertCircle size={18} />
        <p class="text-sm font-bold">{error}</p>
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Telegram Card -->
      <Card
        class="flex flex-col overflow-hidden hover:shadow-md transition-shadow"
      >
        <div class="p-6 border-b border-gray-100 bg-gray-50/50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"
              >
                <Send size={20} />
              </div>
              <div>
                <h3 class="font-bold text-gray-900">Telegram Bot</h3>
                <p class="text-xs text-gray-500">
                  Enable AI chat and order tracking on Telegram.
                </p>
              </div>
            </div>
            <Toggle
              class="p-0 border-none bg-transparent hover:bg-transparent"
              checked={val("telegram_enabled", "0") === "1"}
              onchange={(e) =>
                (data.telegram_enabled = (e.target as HTMLInputElement).checked
                  ? "1"
                  : "0")}
              aria-label="Toggle Telegram Bot"
            />
          </div>
        </div>

        <div class="p-6 space-y-6 flex-1">
          <!-- Bot Token -->
          <div class="space-y-2">
            <Input
              id="t-token"
              label="Bot API Token"
              type={showTelegramKey ? "text" : "password"}
              bind:value={telegramKeyInput}
              placeholder={data.telegram_bot_token_set
                ? "••••••••••••••••••••••••••••"
                : "Paste token from @BotFather"}
              class="font-mono"
            >
              {#snippet labelExtra()}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  class="text-gray-400 hover:text-blue-600 transition-colors inline-flex ml-1"
                  title="Get token from @BotFather"
                >
                  <ExternalLink size={14} />
                </a>
              {/snippet}
              <button
                type="button"
                onclick={() => (showTelegramKey = !showTelegramKey)}
                class="absolute right-3 top-[34px] -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                slot="right"
              >
                {#if showTelegramKey}<EyeOff size={18} />{:else}<Eye
                    size={18}
                  />{/if}
              </button>
            </Input>
          </div>

          <!-- Bot Mode -->
          <div class="space-y-3">
            <span
              class="text-sm font-semibold text-gray-700 flex items-center gap-2"
            >
              Connection Mode
              <Badge class="bg-gray-100 text-gray-500 border-none font-bold"
                >Advanced</Badge
              >
            </span>
            <div class="grid grid-cols-2 gap-3">
              {#each [["polling", "🔄 Polling", "Simple, no HTTPS required."], ["webhook", "🔗 Webhook", "Fast, needs public HTTPS."]] as [modeId, label, desc]}
                <Button
                  variant={telegramMode === modeId ? "primary" : "secondary"}
                  onclick={() =>
                    (telegramMode = modeId as "polling" | "webhook")}
                  class="flex-col items-start h-auto p-3 text-left {telegramMode ===
                  modeId
                    ? 'border-blue-600 bg-blue-50/50 shadow-blue-50'
                    : ''}"
                >
                  <span>{label}</span>
                  <span class="text-[11px] mt-0.5 leading-tight font-medium">
                    {desc}
                  </span>
                </Button>
              {/each}
            </div>
          </div>

          <!-- Webhook Settings -->
          {#if telegramMode === "webhook"}
            <div
              class="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-300"
            >
              <div class="flex items-center gap-2 text-blue-700">
                <Info size={16} />
                <span class="text-xs font-bold uppercase tracking-wider"
                  >Webhook Configuration</span
                >
              </div>

              {#if defaultTelegramWebhookUrl}
                <div class="space-y-1.5">
                  <p
                    class="text-[11px] font-bold text-gray-500 uppercase tracking-tight"
                  >
                    Endpoint URL
                  </p>
                  <div class="flex items-center gap-2">
                    <code
                      class="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-mono text-gray-600 truncate"
                    >
                      {defaultTelegramWebhookUrl}
                    </code>
                    <button
                      type="button"
                      onclick={async () => {
                        await navigator.clipboard.writeText(
                          defaultTelegramWebhookUrl,
                        );
                        telegramWebhookUrlCopied = true;
                        setTimeout(
                          () => (telegramWebhookUrlCopied = false),
                          2000,
                        );
                      }}
                      class="shrink-0 rounded-lg bg-white border border-gray-200 px-3 py-2 text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                    >
                      {telegramWebhookUrlCopied ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>
              {/if}

              <div class="space-y-1.5">
                <label
                  for="t-webhook-custom"
                  class="text-[11px] font-bold text-gray-500 uppercase tracking-tight"
                  >Custom URL Override</label
                >
                <input
                  id="t-webhook-custom"
                  type="text"
                  bind:value={telegramCustomUrl}
                  placeholder="https://..."
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-mono focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 shadow-sm"
                />
              </div>
            </div>
          {/if}

          <!-- Seller Notifications Telegram -->
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <span
                class="text-sm font-semibold text-gray-700 flex items-center gap-2"
              >
                <BellRing size={16} class="text-blue-500" />
                Order Notifications
              </span>
            </div>
            <div
              class="p-4 rounded-xl border border-gray-100 bg-gray-50/30 space-y-3"
            >
              <div>
                <Input
                  id="tg-chat"
                  label="Telegram Chat ID"
                  value={val("telegram_notify_chat_id")}
                  oninput={(e: Event) =>
                    (data.telegram_notify_chat_id = (
                      e.target as HTMLInputElement
                    ).value)}
                  placeholder="e.g. 12345678"
                />
              </div>
              <div
                class="flex items-start gap-2 text-[11px] text-gray-400 leading-tight"
              >
                <Info size={14} class="shrink-0 mt-0.5" />
                <p>Send <code>/myid</code> to your bot to get this ID.</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <!-- WhatsApp Card -->
      <Card
        class="flex flex-col overflow-hidden hover:shadow-md transition-shadow"
      >
        <div class="p-6 border-b border-gray-100 bg-emerald-50/30">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600"
              >
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 class="font-bold text-gray-900">WhatsApp Business</h3>
                <p class="text-xs text-gray-500">
                  Connect with customers via the world's most popular app.
                </p>
              </div>
            </div>
            <Toggle
              class="p-0 border-none bg-transparent hover:bg-transparent"
              checked={val("whatsapp_enabled", "0") === "1"}
              onchange={(e) =>
                (data.whatsapp_enabled = (e.target as HTMLInputElement).checked
                  ? "1"
                  : "0")}
              aria-label="Toggle WhatsApp Business"
            />
          </div>
        </div>

        <div class="p-6 space-y-6 flex-1">
          <div
            class="flex flex-col items-center justify-center py-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200"
          >
            <Smartphone size={32} class="text-gray-300 mb-2" />
            <span
              class="text-xs font-semibold text-gray-600 uppercase tracking-wider"
              >Cloud API Mode</span
            >
            <p class="text-[11px] text-gray-400 mt-1 max-w-[200px]">
              Managed by shared prompt-commerce gateway
            </p>
          </div>

          <!-- WhatsApp Notifications -->
          <div class="space-y-3">
            <span
              class="text-sm font-semibold text-gray-700 flex items-center gap-2"
            >
              <BellRing size={16} class="text-emerald-500" />
              Order Notifications
            </span>
            <div
              class="p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 space-y-3"
            >
              <div>
                <Input
                  id="wa-notify-id"
                  label="WhatsApp Phone Number"
                  value={val("whatsapp_notify_number")}
                  oninput={(e: Event) =>
                    (data.whatsapp_notify_number = (
                      e.target as HTMLInputElement
                    ).value)}
                  placeholder="e.g. 639171234567"
                  class="border-emerald-200 focus:border-emerald-500"
                />
              </div>
              <div
                class="flex items-start gap-2 text-[11px] text-emerald-600/60 leading-tight"
              >
                <Info size={14} class="shrink-0 mt-0.5" />
                <p>
                  Include country code, no + or leading zeros. (e.g. 63 for PH)
                </p>
              </div>
            </div>
          </div>

          <div class="flex-1"></div>

          <div class="p-4 rounded-xl bg-emerald-50 flex items-center gap-3">
            <div class="p-2 rounded-lg bg-white shadow-sm">
              <Bot size={18} class="text-emerald-600" />
            </div>
            <div>
              <p class="text-xs font-bold text-emerald-900 leading-none">
                AI Assistant is active
              </p>
              <p
                class="text-[10px] text-emerald-700/70 mt-1 uppercase tracking-wider font-bold"
              >
                Standard Storefront Enabled
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Actions & Status Bar -->
    <div
      class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-4 -mx-6 flex items-center justify-between z-20"
    >
      <div class="flex items-center gap-3">
        <Button
          onclick={saveMessaging}
          disabled={saving}
          variant="primary"
          class="px-6 py-2.5 bg-gray-900 border-none hover:bg-gray-800 shadow-gray-200"
        >
          {#if saving}
            <RefreshCw size={18} class="animate-spin mr-2" /> Saving...
          {:else if saved}
            <Check size={18} class="mr-2" /> Saved!
          {:else}
            Save Messaging Settings
          {/if}
        </Button>

        <!-- Status Badges -->
        <div class="hidden sm:flex items-center gap-2">
          {#if telegramBotStatus === "checking"}
            <Badge
              class="bg-gray-100 text-gray-500 border-none px-3 py-1.5 font-bold"
            >
              <div
                class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse mr-1"
              ></div>
              Verifying Bot...
            </Badge>
          {:else if telegramBotStatus === "active"}
            <Badge
              class="bg-green-100 text-green-700 border-none px-3 py-1.5 font-bold"
            >
              <div
                class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] mr-1"
              ></div>
              Telegram Active
            </Badge>
          {:else if telegramBotStatus === "failed"}
            <Badge
              class="bg-red-100 text-red-700 border-none px-3 py-1.5 font-bold"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1"></div>
              Telegram Unreachable
            </Badge>
          {/if}

          {#if whatsappStatus === "active"}
            <Badge
              class="bg-emerald-100 text-emerald-700 border-none px-3 py-1.5 font-bold"
            >
              <div
                class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] mr-1"
              ></div>
              WhatsApp Active
            </Badge>
          {:else}
            <Badge
              class="bg-amber-100 text-amber-700 border-none px-3 py-1.5 font-bold"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></div>
              WhatsApp Config Required
            </Badge>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
