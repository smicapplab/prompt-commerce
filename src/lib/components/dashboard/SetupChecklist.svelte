<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import type { Stats } from "$lib/types/dashboard.js";
  import type { StoreSettings } from "$lib/types/settings.js";

  interface Props {
    storeSettings: StoreSettings;
    stats: Stats;
  }

  let { storeSettings, stats }: Props = $props();

  const hasAiKey = $derived(
    !!(storeSettings.claude_api_key_set ||
    storeSettings.gemini_api_key_set ||
    storeSettings.openai_api_key_set)
  );
  
  const aiDone = $derived(hasAiKey && String(storeSettings.ai_enabled) === "1");
  
  const hasMessaging = $derived(
    (storeSettings.telegram_bot_token_set &&
      String(storeSettings.telegram_enabled) === "1") ||
    (!!storeSettings.whatsapp_notify_number &&
      String(storeSettings.whatsapp_enabled) === "1")
  );
  
  const hasPayment = $derived(
    !!(storeSettings.payment_api_key_set ||
    (Array.isArray(storeSettings.payment_methods) && storeSettings.payment_methods.length > 0))
  );

  const steps = $derived([
    {
      id: "products",
      label: "Add Products",
      done: stats.products > 0,
      href: "/admin/products",
    },
    {
      id: "ai",
      label: "Configure AI",
      done: !!aiDone,
      href: "/admin/settings?tab=ai",
    },
    {
      id: "messaging",
      label: "Messaging Setup",
      done: !!hasMessaging,
      href: "/admin/settings?tab=telegram",
    },
    {
      id: "payments",
      label: "Enable Payments",
      done: !!hasPayment,
      href: "/admin/settings?tab=payments",
    },
  ]);

  const incompleteSteps = $derived(steps.filter((s) => !s.done));
  const doneCount = $derived(steps.filter((s) => s.done).length);
</script>

{#if incompleteSteps.length > 0}
  <Card class="bg-indigo-50/50 border-indigo-100 p-6">
    <div class="flex items-center justify-between mb-4">
      <h2
        class="text-sm font-bold text-indigo-900 uppercase tracking-wider"
      >
        Getting Started
      </h2>
      <Badge
        class="text-xs font-medium text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-100 italic"
      >
        {doneCount} of {steps.length} steps complete
      </Badge>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      {#each steps as step}
        <a
          href={step.href}
          class="flex items-center gap-3 p-3 rounded-xl bg-white border {step.done
            ? 'border-indigo-200/50 opacity-60'
            : 'border-indigo-200 shadow-sm hover:border-indigo-400 hover:shadow-md'} transition-all group"
        >
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
            {step.done
              ? 'bg-indigo-600 border-indigo-600'
              : 'border-indigo-300 group-hover:border-indigo-500'}"
          >
            {#if step.done}
              <svg
                class="w-3 h-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            {/if}
          </div>
          <span
            class="text-sm font-bold {step.done
              ? 'text-indigo-400 line-through'
              : 'text-indigo-900'}">{step.label}</span
          >
        </a>
      {/each}
    </div>
  </Card>
{/if}
