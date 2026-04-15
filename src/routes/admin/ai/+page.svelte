<script lang="ts">
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { chatStore, type Message } from "$lib/stores/chatStore.svelte.js";
  import {
    Bot,
    BarChart2,
    Package,
    ShoppingCart,
    Tag,
  } from "@lucide/svelte";

  import type { ModelOption } from "$lib/types/ai.js";

  // Components
  import AiChatHeader from "$lib/components/ai/AiChatHeader.svelte";
  import AiMessageList from "$lib/components/ai/AiMessageList.svelte";
  import AiQuickActions from "$lib/components/ai/AiQuickActions.svelte";
  import AiChatComposer from "$lib/components/ai/AiChatComposer.svelte";

  // State
  let inputText = $state("");
  let sending = $state(false);
  let selectedModel = $state("");
  let models = $state<ModelOption[]>([]);
  let modelsLoading = $state(true);
  let hasClaudeKey = $state(false);
  let hasGeminiKey = $state(false);
  let hasOpenaiKey = $state(false);
  let settingsChecked = $state(false);

  // File attachment
  let attachedFile = $state<{
    data: string;
    mimeType: string;
    name: string;
  } | null>(null);
  let filePreview = $state<string | null>(null);
  let chatEndEl = $state<HTMLDivElement>();
  let composer = $state<ReturnType<typeof AiChatComposer>>();

  function token() {
    return localStorage.getItem("pc_token") ?? "";
  }

  async function loadSettings() {
    if (!activeStore.slug) return;
    const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      const data = await res.json();
      hasClaudeKey = !!data.claude_api_key_set;
      hasGeminiKey = !!data.gemini_api_key_set;
      hasOpenaiKey = !!data.openai_api_key_set;
    }
    settingsChecked = true;
  }

  async function loadModels() {
    if (!activeStore.slug) return;
    modelsLoading = true;
    const all: ModelOption[] = [];

    // Load Gemini models
    if (hasGeminiKey) {
      try {
        const res = await fetch(`/api/ai/models?store=${activeStore.slug}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.ok) {
          const data = await res.json();
          for (const m of data.models ?? []) {
            all.push({
              id: m.id,
              displayName: m.displayName,
              provider: "gemini",
            });
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Load Claude models
    if (hasClaudeKey) {
      try {
        const res = await fetch(`/api/ai/models/claude`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.ok) {
          const data = await res.json();
          for (const m of data.models ?? []) {
            all.push({
              id: m.id,
              displayName: m.displayName,
              provider: "claude",
            });
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Load OpenAI models
    if (hasOpenaiKey) {
      try {
        const res = await fetch(`/api/ai/models/openai`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.ok) {
          const data = await res.json();
          for (const m of data.models ?? []) {
            all.push({
              id: m.id,
              displayName: m.displayName,
              provider: "openai",
            });
          }
        }
      } catch {
        /* ignore */
      }
    }

    models = all;
    if (all.length > 0 && !selectedModel) {
      selectedModel = all[0].id;
    }
    modelsLoading = false;
  }

  onMount(async () => {
    if (!activeStore.slug) {
      goto("/admin");
      return;
    }
    chatStore.load(activeStore.slug);
    await loadSettings();
    if (hasClaudeKey || hasGeminiKey || hasOpenaiKey) {
      await loadModels();
    }
  });

  async function scrollToBottom() {
    await tick();
    chatEndEl?.scrollIntoView({ behavior: "smooth" });
  }

  async function sendMessage() {
    const text = inputText.trim();
    if ((!text && !attachedFile) || sending || !selectedModel) return;

    const userMsg: Message = {
      role: "user",
      content: text,
      file: attachedFile
        ? { name: attachedFile.name, preview: filePreview ?? undefined }
        : undefined,
    };
    chatStore.addMessage(activeStore.slug, userMsg);

    inputText = "";
    const fileToSend = attachedFile;
    attachedFile = null;
    filePreview = null;
    sending = true;
    await scrollToBottom();

    try {
      const apiMessages = chatStore.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const body: any = { model: selectedModel, messages: apiMessages };
      if (fileToSend) body.file = fileToSend;

      const res = await fetch(`/api/ai/chat?store=${activeStore.slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: `Server returned an invalid response (${res.status})` };
      }

      if (res.ok && data.reply) {
        chatStore.addMessage(activeStore.slug, {
          role: "assistant",
          content: data.reply,
        });
      } else {
        chatStore.addMessage(activeStore.slug, {
          role: "assistant",
          content: `Error: ${data.error ?? "Unknown error"}`,
        });
      }
    } catch (err: any) {
      chatStore.addMessage(activeStore.slug, {
        role: "assistant",
        content: `Network error: ${err.message}`,
      });
    } finally {
      sending = false;
      await scrollToBottom();
      composer?.focus();
    }
  }

  function clearHistory() {
    chatStore.clear(activeStore.slug);
    attachedFile = null;
    filePreview = null;
  }

  const quickActions = [
    {
      icon: BarChart2,
      label: "Store overview",
      text: "Give me a full overview of the store — products, orders, revenue, and any items needing attention.",
    },
    {
      icon: Package,
      label: "Low stock alert",
      text: "Which products are running low on stock (5 or fewer units)? Show me the details and suggest reorder quantities.",
    },
    {
      icon: ShoppingCart,
      label: "Recent orders",
      text: "Show me the most recent 10 orders. Highlight any that are still pending or have issues.",
    },
    {
      icon: Tag,
      label: "Active promotions",
      text: "What promotions and voucher codes are currently active? Are any expiring soon?",
    },
  ];

  function sendQuick(text: string) {
    inputText = text;
    sendMessage();
  }

  $effect(() => {
    // Re-check models whenever keys change
    if (settingsChecked && (hasClaudeKey || hasGeminiKey || hasOpenaiKey)) {
      loadModels();
    }
  });

  // Group models for display in selector
  const geminiModels = $derived(models.filter((m) => m.provider === "gemini"));
  const claudeModels = $derived(models.filter((m) => m.provider === "claude"));
  const openaiModels = $derived(models.filter((m) => m.provider === "openai"));

  function modelLabel(id: string) {
    return models.find((m) => m.id === id)?.displayName ?? id;
  }
</script>

<svelte:head
  ><title>AI Assistant — {activeStore.name || "Store"}</title></svelte:head
>

<div class="flex flex-col h-full" style="height: calc(100vh - 57px);">
  <AiChatHeader
    activeStoreName={activeStore.name}
    {models}
    bind:selectedModel
    {modelsLoading}
    hasMessages={chatStore.messages.length > 0}
    onClear={clearHistory}
    {geminiModels}
    {claudeModels}
    {openaiModels}
  />

  <!-- Body -->
  <div class="flex-1 overflow-y-auto relative">
    <!-- No AI configured overlay -->
    {#if settingsChecked && !hasClaudeKey && !hasGeminiKey && !hasOpenaiKey}
      <div
        class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-10 p-6"
      >
        <div
          class="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4"
        >
          <Bot class="w-8 h-8 text-violet-500" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 mb-1">
          Connect AI to Start
        </h2>
        <p class="text-sm text-gray-500 text-center max-w-xs mb-5">
          Add an OpenAI, Claude, or Gemini API key in your store settings to enable the AI
          assistant.
        </p>
        <a
          href="/admin/settings"
          class="px-5 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
        >
          Go to AI Settings
        </a>
      </div>
    {/if}

    <!-- Welcome screen -->
    {#if chatStore.messages.length === 0}
      <div
        class="flex flex-col items-center justify-center min-h-full py-12 px-6"
      >
        <div
          class="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-200"
        >
          <Bot class="w-8 h-8 text-white" />
        </div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">
          How can I help?
        </h2>
        <p class="text-sm text-gray-500 text-center max-w-sm mb-8">
          I'm your store assistant. Ask me about products, orders, promotions,
          or anything about your store.
        </p>

        {#if models.length > 0}
          <AiQuickActions {quickActions} onSend={sendQuick} />
        {/if}
      </div>
    {:else}
      <AiMessageList
        messages={chatStore.messages}
        {sending}
        bind:chatEndEl
      />
    {/if}
  </div>

  <AiChatComposer
    bind:this={composer}
    bind:inputText
    bind:attachedFile
    bind:filePreview
    {sending}
    onSend={sendMessage}
    hasModels={models.length > 0}
    {settingsChecked}
    {selectedModel}
    selectedModelLabel={modelLabel(selectedModel)}
    activeStoreName={activeStore.name}
  />
</div>
