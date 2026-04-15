<script lang="ts">
  import {
    Check,
    CreditCard,
    Banknote,
    FlaskConical,
    ShieldCheck,
    Eye,
    EyeOff,
    ExternalLink,
    RefreshCw,
    TriangleAlert,
    Handshake,
    Globe,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import { fade } from "svelte/transition";

  // Internal state
  let data = $state<Record<string, string | boolean>>({});
  let serverSettings = $state<Record<string, string>>({});
  let loading = $state(false);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state("");

  // Input states for keys (masked by server)
  let assistedLabelInput = $state("");
  let paymentInstructionsInput = $state("");
  let paymentLinkTemplateInput = $state("");
  let paymentApiKeyInput = $state("");
  let paymentWebhookSecretInput = $state("");

  // Visibility toggles
  let showPaymentApiKey = $state(false);
  let showPaymentWebhookSecret = $state(false);

  const token = () => localStorage.getItem("pc_token") ?? "";

  function val(key: string, fallback = ""): string {
    return String(data[key] ?? fallback);
  }

  const methods = [
    {
      id: "cod",
      label: "Cash on Delivery",
      icon: Banknote,
      desc: "Pay when delivered",
      color: "text-emerald-500",
    },
    {
      id: "mock",
      label: "Mock Payment",
      icon: FlaskConical,
      desc: "Simulated checkout",
      color: "text-amber-500",
    },
    {
      id: "assisted",
      label: "Assisted Pay",
      icon: Handshake,
      desc: "Manual bank/GCash",
      color: "text-blue-500",
    },
    {
      id: "paymongo",
      label: "PayMongo",
      icon: CreditCard,
      desc: "PH Cards/E-wallets",
      color: "text-indigo-500",
    },
    {
      id: "stripe",
      label: "Stripe",
      icon: Globe,
      desc: "Global card payments",
      color: "text-purple-500",
    },
  ];

  $effect(() => {
    if (activeStore.slug) load();
  });

  async function load() {
    if (!activeStore.slug) return;
    loading = true;
    error = "";
    try {
      // Load server settings for gateway_url
      const srvRes = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (srvRes.ok) serverSettings = await srvRes.json();

      // Load store settings
      const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        data = await res.json();
        assistedLabelInput = val("assisted_label");
        paymentInstructionsInput = val("payment_instructions");
        paymentLinkTemplateInput = val("payment_link_template");
      }
    } catch (e) {
      error = "Load failed";
    } finally {
      loading = false;
    }
  }

  function togglePaymentMethod(m: string) {
    let current = [];
    try {
      current = JSON.parse(val("payment_methods", "[]"));
    } catch {
      current = [];
    }
    if (current.includes(m)) {
      current = current.filter((x: string) => x !== m);
    } else {
      current.push(m);
    }
    data.payment_methods = JSON.stringify(current);
  }

  async function savePayments() {
    if (!activeStore.slug) return;
    saving = true;
    saved = false;
    error = "";

    const payload: Record<string, string | null> = {
      payment_methods: val("payment_methods", "[]"),
      assisted_label: assistedLabelInput.trim() || null,
      payment_instructions: paymentInstructionsInput.trim() || null,
      payment_link_template: paymentLinkTemplateInput.trim() || null,
      payment_public_key: String(data.payment_public_key ?? ""),
    };
    if (paymentApiKeyInput) payload.payment_api_key = paymentApiKeyInput.trim();
    if (paymentWebhookSecretInput)
      payload.payment_webhook_secret = paymentWebhookSecretInput.trim();

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
        paymentApiKeyInput = paymentWebhookSecretInput = "";
        saved = true;
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
      <CreditCard size={32} />
    </div>
    <h3 class="text-lg font-medium text-gray-900">No Store Selected</h3>
    <p class="text-sm text-gray-500 max-w-xs mt-1">
      Select a store to configure payment processing.
    </p>
  </div>
{:else if loading && !data.payment_methods}
  <div class="flex items-center justify-center py-20">
    <RefreshCw size={32} class="animate-spin text-gray-300" />
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

    {#if error}
      <div
        class="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700 shadow-sm"
      >
        <TriangleAlert size={18} />
        <p class="text-sm font-bold">{error}</p>
      </div>
    {/if}

    <!-- Methods Selection -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {#each methods as m}
        {@const isActive = val("payment_methods", "[]").includes(m.id)}
        <Button
          variant={isActive ? "primary" : "secondary"}
          onclick={() => togglePaymentMethod(m.id)}
          class="flex flex-col items-start p-4 h-full group {isActive
            ? 'border-indigo-600 bg-indigo-50/50 shadow-indigo-50'
            : ''}"
        >
          <div
            class="mb-3 transition-all duration-300 {isActive
              ? 'w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-xl shadow-indigo-900/20 scale-110 -rotate-3'
              : 'group-hover:scale-110'}"
          >
            <m.icon size={isActive ? 24 : 28} class={m.color} />
          </div>
          <span class="text-xs font-black uppercase tracking-tight">
            {m.label}
          </span>
          <p class="text-[10px] mt-0.5 leading-tight">{m.desc}</p>
          <div class="mt-auto pt-3">
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center {isActive
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-gray-200'}"
            >
              {#if isActive}<Check size={12} strokeWidth={4} />{/if}
            </div>
          </div>
        </Button>
      {/each}
    </div>

    <div class="space-y-6">
      <!-- Assisted Configuration -->
      {#if val("payment_methods", "[]").includes("assisted")}
        <Card
          class="border-indigo-100 overflow-hidden animate-in slide-in-from-top-2"
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
              <Input
                id="p-label"
                label="Checkout Button Label"
                bind:value={assistedLabelInput}
                placeholder="e.g. Bank Transfer / GCash"
                description="The primary label shown during checkout selection."
              />
              <Input
                id="p-tmpl"
                label="Static Payment Link (Optional)"
                bind:value={paymentLinkTemplateInput}
                placeholder={"https://qr.me/mystore/{{amount}}"}
                class="font-mono"
              />
            </div>
            <div class="space-y-2">
              <label
                for="p-inst"
                class="block text-sm font-bold text-gray-900 mb-1"
                >Payment Instructions</label
              >
              <textarea
                id="p-inst"
                rows="5"
                bind:value={paymentInstructionsInput}
                placeholder="e.g. Please transfer to: BDO: 00123456789, GCash: 0917-XXX-XXXX..."
                class="w-full rounded-xl border border-gray-200 bg-white p-4 text-xs leading-relaxed focus:border-indigo-500 outline-none transition-all resize-none shadow-sm"
              ></textarea>
            </div>
          </div>
        </Card>
      {/if}

      <!-- Online Gateways -->
      {#if val("payment_methods", "[]").includes("paymongo") || val("payment_methods", "[]").includes("stripe")}
        <Card class="overflow-hidden animate-in slide-in-from-top-2">
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
            <Badge
              class="bg-indigo-100 text-indigo-700 border-indigo-200 uppercase"
            >
              {val("payment_methods", "[]").includes("paymongo")
                ? "PayMongo"
                : "Stripe"} ACTIVE
            </Badge>
          </div>

          <div class="p-6 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                id="p-api"
                label="Secret Key"
                type={showPaymentApiKey ? "text" : "password"}
                bind:value={paymentApiKeyInput}
                placeholder={data.payment_api_key_set
                  ? "••••••••••••••••••••••••••••"
                  : "sk_test_..."}
                class="font-mono text-xs"
              >
                {#snippet right()}
                  <button
                    type="button"
                    onclick={() => (showPaymentApiKey = !showPaymentApiKey)}
                    class="text-gray-300 hover:text-gray-500 p-2"
                  >
                    {#if showPaymentApiKey}<EyeOff size={16} />{:else}<Eye
                        size={16}
                      />{/if}
                  </button>
                {/snippet}
              </Input>
              <Input
                id="p-pub"
                label="Public Key / Merchant ID"
                value={val("payment_public_key")}
                oninput={(e: Event) =>
                  (data.payment_public_key = (
                    e.target as HTMLInputElement
                  ).value)}
                placeholder="pk_test_..."
                class="font-mono text-xs"
              />
            </div>

            <Input
              id="p-web"
              label="Webhook Secret"
              type={showPaymentWebhookSecret ? "text" : "password"}
              bind:value={paymentWebhookSecretInput}
              placeholder={data.payment_webhook_secret_set
                ? "••••••••••••••••••••••••••••"
                : "whsec_..."}
              class="font-mono text-xs"
            >
              {#snippet right()}
                <button
                  type="button"
                  onclick={() =>
                    (showPaymentWebhookSecret = !showPaymentWebhookSecret)}
                  class="text-gray-300 hover:text-gray-500 p-2"
                >
                  {#if showPaymentWebhookSecret}<EyeOff size={16} />{:else}<Eye
                      size={16}
                    />{/if}
                </button>
              {/snippet}
            </Input>
            <div
              class="mt-4 p-4 rounded-xl bg-gray-900 text-gray-400 border border-gray-800"
            >
              <div class="flex items-center justify-between mb-3">
                <span
                  class="text-[10px] font-black uppercase tracking-widest text-indigo-400"
                  >Endpoint URL for Webhooks</span
                >
                <Button
                  size="sm"
                  class="bg-white/10 hover:bg-white/20 text-white border-none"
                  onclick={() => {
                    const url = `${serverSettings.gateway_url?.replace(/\/$/, "")}/webhooks/payment/${activeStore.slug}`;
                    navigator.clipboard.writeText(url);
                  }}>Copy URL</Button
                >
              </div>
              <code class="text-[11px] font-mono break-all text-white/90">
                {serverSettings.gateway_url?.replace(
                  /\/$/,
                  "",
                )}/webhooks/payment/{activeStore.slug}
              </code>
            </div>
          </div>
        </Card>
      {/if}

      {#if val("payment_methods", "[]").includes("mock")}
        <Card
          class="bg-amber-50 border-amber-200 flex items-start gap-4 animate-in zoom-in duration-300 p-6"
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
        </Card>
      {/if}
    </div>

    <!-- Sticky footer actions -->
    <div
      class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-4 -mx-6 flex items-center justify-between z-20"
    >
      <div class="flex items-center gap-3">
        <Button
          onclick={savePayments}
          disabled={saving}
          variant="primary"
          class="px-8 py-3 bg-indigo-600 border-none hover:bg-indigo-700 shadow-indigo-100"
        >
          {#if saving}
            <RefreshCw size={18} class="animate-spin mr-2" /> Saving...
          {:else if saved}
            <Check size={18} class="mr-2" /> Settings Locked
          {:else}
            Save Payment Profile
          {/if}
        </Button>

        {#if saved}
          <div
            transition:fade
            class="flex items-center gap-2 text-[10px] font-black uppercase text-green-600 tracking-widest"
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
