<script lang="ts">
  import {
    Check,
    CreditCard,
    Banknote,
    MousePointer2,
    FlaskConical,
    ShieldCheck,
    Eye,
    EyeOff,
    ExternalLink,
    HelpCircle,
    Info,
    RefreshCw,
    Wallet,
  } from "@lucide/svelte";

  let {
    activeStore,
    storeSettings,
    val,
    set,
    saving,
    saved,
    togglePaymentMethod,
    assistedLabelInput = $bindable(),
    paymentInstructionsInput = $bindable(),
    paymentLinkTemplateInput = $bindable(),
    paymentApiKeyInput = $bindable(),
    showPaymentApiKey = $bindable(),
    showPaymentWebhookSecret = $bindable(),
    paymentWebhookSecretInput = $bindable(),
    savePayments,
  } = $props();

  const methods = [
    {
      id: "cod",
      label: "Cash on Delivery",
      emoji: "💵",
      desc: "Pay when delivered",
    },
    {
      id: "mock",
      label: "Mock Payment",
      emoji: "🧪",
      desc: "Simulated checkout",
    },
    {
      id: "assisted",
      label: "Assisted Pay",
      emoji: "🤝",
      desc: "Manual bank/GCash",
    },
    {
      id: "paymongo",
      label: "PayMongo",
      emoji: "🇵🇭",
      desc: "PH Cards/E-wallets",
    },
    {
      id: "stripe",
      label: "Stripe",
      emoji: "🌍",
      desc: "Global card payments",
    },
  ];
</script>

{#if !activeStore.slug}
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div
      class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4"
    >
      <CreditCard size={32} />
    </div>
    <h3 class="text-lg font-medium text-gray-900">No Store Selected</h3>
    <p class="text-sm text-gray-500 max-w-xs mt-1">
      Select a store to configure payment processing.
    </p>
  </div>
{:else}
  <div class="space-y-8 animate-in fade-in duration-500 pb-20">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 tracking-tight">
        Payment Methods
      </h2>
      <p class="text-sm text-gray-500 mt-1">
        Enable and configure how customers pay for their orders.
      </p>
    </div>

    <!-- Methods Selection -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {#each methods as m}
        <button
          onclick={() => togglePaymentMethod(m.id)}
          class="flex flex-col items-start p-4 rounded-2xl border-2 transition-all group text-left h-full
            {val('payment_methods', '[]').includes(m.id)
            ? 'border-indigo-600 bg-indigo-50/50'
            : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm'}"
        >
          <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">
            {m.emoji}
          </div>
          <span
            class="text-xs font-black uppercase tracking-tight {val(
              'payment_methods',
              '[]',
            ).includes(m.id)
              ? 'text-indigo-900'
              : 'text-gray-900'}"
          >
            {m.label}
          </span>
          <p class="text-[10px] text-gray-400 mt-0.5 leading-tight">{m.desc}</p>
          <div class="mt-auto pt-3">
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center {val(
                'payment_methods',
                '[]',
              ).includes(m.id)
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-gray-200'}"
            >
              {#if val("payment_methods", "[]").includes(m.id)}
                <Check size={12} strokeWidth={4} />
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>

    <div class="space-y-6">
      <!-- Assisted Configuration -->
      {#if val("payment_methods", "[]").includes("assisted")}
        <div
          class="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden animate-in slide-in-from-top-2"
        >
          <div
            class="p-4 border-b border-indigo-50 bg-indigo-50/30 flex items-center gap-2"
          >
            <div
              class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600"
            >
              <Banknote size={16} />
            </div>
            <span class="text-sm font-bold text-indigo-900"
              >Manual / Assigned Payment Config</span
            >
          </div>
          <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label
                  for="p-label"
                  class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5"
                  >Checkout Button Label</label
                >
                <input
                  id="p-label"
                  type="text"
                  bind:value={assistedLabelInput}
                  placeholder="e.g. Bank Transfer / GCash"
                  class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                />
                <p class="mt-1.5 text-[10px] text-gray-400">
                  The primary label shown during checkout selection.
                </p>
              </div>
              <div>
                <label
                  for="p-tmpl"
                  class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5"
                  >Static Payment Link (Optional)</label
                >
                <input
                  id="p-tmpl"
                  type="text"
                  bind:value={paymentLinkTemplateInput}
                  placeholder={"https://qr.me/mystore/{{amount}}"}
                  class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm font-mono focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300"
                />
              </div>
            </div>
            <div>
              <label
                for="p-inst"
                class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5"
                >Payment Instructions</label
              >
              <textarea
                id="p-inst"
                rows="5"
                bind:value={paymentInstructionsInput}
                placeholder="e.g. Please transfer to:
BDO: 00123456789
GCash: 0917-XXX-XXXX
Send proof of payment to this chat."
                class="w-full rounded-xl border border-gray-200 bg-white p-4 text-xs leading-relaxed focus:border-indigo-500 outline-none transition-all resize-none"
              ></textarea>
            </div>
          </div>
        </div>
      {/if}

      <!-- Online Gateways -->
      {#if val("payment_methods", "[]").includes("paymongo") || val("payment_methods", "[]").includes("stripe")}
        <div
          class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2"
        >
          <div
            class="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <div
                class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600"
              >
                <ShieldCheck size={16} />
              </div>
              <span
                class="text-sm font-bold text-gray-900 uppercase tracking-tight"
                >API Gateway Connection</span
              >
            </div>
            <div class="flex items-center gap-2">
              <span
                class="px-2 py-0.5 rounded-md bg-indigo-100 text-[10px] font-black text-indigo-700 uppercase"
                >{val("payment_methods", "[]").includes("paymongo")
                  ? "PayMongo"
                  : "Stripe"} ACTIVE</span
              >
            </div>
          </div>

          <div class="p-6 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  for="p-api"
                  class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5"
                  >Secret Key</label
                >
                <div class="relative">
                  <input
                    id="p-api"
                    type={showPaymentApiKey ? "text" : "password"}
                    bind:value={paymentApiKeyInput}
                    placeholder={storeSettings.payment_api_key_set
                      ? "••••••••••••••••••••••••••••"
                      : "sk_test_..."}
                    class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                  />
                  <button
                    onclick={() => (showPaymentApiKey = !showPaymentApiKey)}
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  >
                    {#if showPaymentApiKey}<EyeOff size={16} />{:else}<Eye
                        size={16}
                      />{/if}
                  </button>
                </div>
              </div>
              <div>
                <label
                  for="p-pub"
                  class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5"
                  >Public Key / Merchant ID</label
                >
                <input
                  id="p-pub"
                  type="text"
                  value={val("payment_public_key")}
                  oninput={(e) =>
                    set(
                      "payment_public_key",
                      (e.target as HTMLInputElement).value,
                    )}
                  placeholder="pk_test_..."
                  class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label
                for="p-web"
                class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5"
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
                  class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                />
                <button
                  onclick={() =>
                    (showPaymentWebhookSecret = !showPaymentWebhookSecret)}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  {#if showPaymentWebhookSecret}<EyeOff size={16} />{:else}<Eye
                      size={16}
                    />{/if}
                </button>
              </div>
              <div
                class="mt-4 p-4 rounded-xl bg-gray-900 text-gray-400 border border-gray-800"
              >
                <div class="flex items-center justify-between mb-3">
                  <span
                    class="text-[10px] font-black uppercase tracking-widest text-indigo-400"
                    >Endpoint URL for Webhooks</span
                  >
                  <button
                    class="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors"
                    onclick={() => {
                      const url = `https://your-gateway.com/webhooks/payment/${activeStore.slug}`;
                      navigator.clipboard.writeText(url);
                    }}>Copy URL</button
                  >
                </div>
                <code class="text-[11px] font-mono break-all text-white/90">
                  https://your-gateway.com/webhooks/payment/{activeStore.slug}
                </code>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Test Mode Notice -->
      {#if val("payment_methods", "[]").includes("mock")}
        <div
          class="p-6 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-4 shadow-sm animate-in zoom-in duration-300"
        >
          <div
            class="w-12 h-12 rounded-xl bg-white border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm shrink-0"
          >
            <FlaskConical size={24} />
          </div>
          <div>
            <h4
              class="text-sm font-black text-amber-900 uppercase tracking-tight"
            >
              Mock Payment Sandbox
            </h4>
            <p class="text-xs text-amber-800/70 mt-1 leading-relaxed">
              Test mode is currently enabled. All transactions will be simulated
              using the internal gateway sandbox. No actual API keys are
              required for this method.
            </p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Sticky footer actions -->
    <div
      class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-4 -mx-6 flex items-center justify-between z-10"
    >
      <div class="flex items-center gap-3">
        <button
          onclick={savePayments}
          disabled={saving}
          class="inline-flex items-center gap-3 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-black text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
        >
          {#if saving}
            <RefreshCw size={18} class="animate-spin" /> Saving...
          {:else if saved === "payments"}
            <Check size={18} /> Settings Locked
          {:else}
            Save Payment Profile
          {/if}
        </button>

        {#if saved === "payments"}
          <div
            class="flex items-center gap-2 text-[10px] font-black uppercase text-green-600 tracking-widest animate-in slide-in-from-left-4"
          >
            <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            Confirmed
          </div>
        {/if}
      </div>

      <a
        href="https://docs.promptcommerce.io/payments"
        target="_blank"
        class="text-[11px] font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
      >
        Payment Documentation <ExternalLink size={12} />
      </a>
    </div>
  </div>
{/if}
