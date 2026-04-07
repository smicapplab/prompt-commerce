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
  } from "@lucide/svelte";

  let {
    activeStore,
    storeSettings,
    val,
    set,
    saving,
    saved,
    telegramMode = $bindable(),
    telegramCustomUrl = $bindable(),
    telegramKeyInput = $bindable(),
    showTelegramKey = $bindable(),
    telegramBotStatus,
    telegramBotStatusInfo,
    telegramWebhookUrlCopied = $bindable(),
    defaultTelegramWebhookUrl,
    whatsappStatus,
    saveMessaging,
  } = $props();
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
{:else}
  <div class="space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 tracking-tight">
        Messaging Channels
      </h2>
      <p class="text-sm text-gray-500 mt-1">
        Configure how your AI interacts with customers on Telegram and WhatsApp.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Telegram Card -->
      <div
        class="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
      >
        <div class="p-6 border-b border-gray-100 bg-gray-50/50">
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
        </div>

        <div class="p-6 space-y-6 flex-1">
          <!-- Bot Token -->
          <div class="space-y-2">
            <label
              for="t-token"
              class="text-sm font-semibold text-gray-700 flex items-center gap-2"
            >
              Bot API Token
              <a
                href="https://t.me/BotFather"
                target="_blank"
                class="text-gray-400 hover:text-blue-600 transition-colors"
                title="Get token from @BotFather"
              >
                <ExternalLink size={14} />
              </a>
            </label>
            <div class="relative group">
              <input
                id="t-token"
                type={showTelegramKey ? "text" : "password"}
                bind:value={telegramKeyInput}
                placeholder={storeSettings.telegram_bot_token_set
                  ? "••••••••••••••••••••••••••••"
                  : "Paste token from @BotFather"}
                class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-12 text-sm font-mono focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all"
              />
              <button
                type="button"
                onclick={() => (showTelegramKey = !showTelegramKey)}
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {#if showTelegramKey}<EyeOff size={18} />{:else}<Eye
                    size={18}
                  />{/if}
              </button>
            </div>
          </div>

          <!-- Bot Mode -->
          <div class="space-y-3">
            <span
              class="text-sm font-semibold text-gray-700 flex items-center gap-2"
            >
              Connection Mode
              <span
                class="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-tight"
                >Advanced</span
              >
            </span>
            <div class="grid grid-cols-2 gap-3">
              {#each [["polling", "🔄 Polling", "Simple, no HTTPS required."], ["webhook", "🔗 Webhook", "Fast, needs public HTTPS."]] as [modeId, label, desc]}
                <button
                  type="button"
                  onclick={() => {
                    telegramMode = modeId as "polling" | "webhook";
                  }}
                  class="flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left
                    {telegramMode === modeId
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-gray-100 bg-white hover:border-gray-200'}"
                >
                  <span
                    class="text-sm font-bold {telegramMode === modeId
                      ? 'text-blue-700'
                      : 'text-gray-900'}">{label}</span
                  >
                  <span
                    class="text-[11px] {telegramMode === modeId
                      ? 'text-blue-600/70'
                      : 'text-gray-400'} mt-0.5 leading-tight">{desc}</span
                  >
                </button>
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
                >
                  Custom URL Override
                </label>
                <input
                  id="t-webhook-custom"
                  type="text"
                  bind:value={telegramCustomUrl}
                  placeholder="https://..."
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-mono focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
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
                <label
                  for="tg-chat"
                  class="block text-[11px] font-bold text-gray-500 uppercase tracking-tight mb-1"
                  >Telegram Chat ID</label
                >
                <input
                  id="tg-chat"
                  type="text"
                  value={val("telegram_notify_chat_id")}
                  oninput={(e) =>
                    set(
                      "telegram_notify_chat_id",
                      (e.target as HTMLInputElement).value,
                    )}
                  placeholder="e.g. 12345678"
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 outline-none"
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
      </div>

      <!-- WhatsApp Card -->
      <div
        class="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
      >
        <div class="p-6 border-b border-gray-100 bg-emerald-50/30">
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
                <label
                  for="wa-notify-id"
                  class="block text-[11px] font-bold text-gray-500 uppercase tracking-tight mb-1"
                  >WhatsApp Phone Number</label
                >
                <input
                  id="wa-notify-id"
                  type="text"
                  value={val("whatsapp_notify_number")}
                  oninput={(e) =>
                    set(
                      "whatsapp_notify_number",
                      (e.target as HTMLInputElement).value,
                    )}
                  placeholder="e.g. 639171234567"
                  class="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 outline-none"
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
      </div>
    </div>

    <!-- Actions & Status Bar -->
    <div
      class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-4 -mx-6 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <button
          onclick={saveMessaging}
          disabled={saving}
          class="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-gray-200"
        >
          {#if saving}
            <div
              class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
            Saving...
          {:else if saved === "telegram"}
            <Check size={18} />
            Saved!
          {:else}
            Save Settings
          {/if}
        </button>

        <!-- Status Badges -->
        <div class="hidden sm:flex items-center gap-2">
          {#if telegramBotStatus === "checking"}
            <div
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-[10px] uppercase font-bold tracking-wider"
            >
              <div
                class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse"
              ></div>
              Verifying Bot...
            </div>
          {:else if telegramBotStatus === "active"}
            <div
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-[10px] uppercase font-bold tracking-wider"
            >
              <div
                class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
              ></div>
              Telegram Active
            </div>
          {:else if telegramBotStatus === "failed"}
            <div
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-[10px] uppercase font-bold tracking-wider"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
              Telegram Unreachable
            </div>
          {/if}

          {#if whatsappStatus === "active"}
            <div
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold tracking-wider"
            >
              <div
                class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              ></div>
              WhatsApp Active
            </div>
          {:else}
            <div
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] uppercase font-bold tracking-wider"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
              WhatsApp Config Required
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
