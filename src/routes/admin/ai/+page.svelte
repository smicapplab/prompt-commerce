<script lang="ts">
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import { chatStore, type Message } from "$lib/stores/chatStore.svelte.js";
  import {
    Bot,
    Send,
    Paperclip,
    Trash2,
    Settings,
    X,
    ChevronDown,
  } from "@lucide/svelte";
  import { marked } from "marked";

  interface ModelOption {
    id: string;
    displayName: string;
    provider: "claude" | "gemini" | "openai";
  }

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
  let fileInputEl = $state<HTMLInputElement>();
  let chatEndEl = $state<HTMLDivElement>();
  let textareaEl = $state<HTMLTextAreaElement>();

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
          content: `⚠️ Error: ${data.error ?? "Unknown error"}`,
        });
      }
    } catch (err: any) {
      chatStore.addMessage(activeStore.slug, {
        role: "assistant",
        content: `⚠️ Network error: ${err.message}`,
      });
    } finally {
      sending = false;
      await scrollToBottom();
      textareaEl?.focus();
    }
  }

  function clearHistory() {
    chatStore.clear(activeStore.slug);
    attachedFile = null;
    filePreview = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // result is a data URL: "data:<mime>;base64,<data>"
      const [header, data] = result.split(",");
      const mimeType = header.split(":")[1].split(";")[0];
      attachedFile = { data, mimeType, name: file.name };

      // Set preview for images
      if (mimeType.startsWith("image/")) {
        filePreview = result;
      } else {
        filePreview = null;
      }
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be reselected
    (e.target as HTMLInputElement).value = "";
  }

  function removeAttachment() {
    attachedFile = null;
    filePreview = null;
  }

  const quickActions = [
    {
      label: "📊 Store overview",
      text: "Give me a full overview of the store — products, orders, revenue, and any items needing attention.",
    },
    {
      label: "📦 Low stock alert",
      text: "Which products are running low on stock (5 or fewer units)? Show me the details and suggest reorder quantities.",
    },
    {
      label: "🛒 Recent orders",
      text: "Show me the most recent 10 orders. Highlight any that are still pending or have issues.",
    },
    {
      label: "🏷️ Active promotions",
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
  <!-- Header -->
  <div
    class="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
      >
        <Bot class="w-4 h-4 text-white" />
      </div>
      <div>
        <h1 class="text-sm font-semibold text-gray-900">AI Assistant</h1>
        <p class="text-xs text-gray-500">{activeStore.name}</p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <!-- Model selector -->
      {#if !modelsLoading && models.length > 0}
        <div class="relative">
          <select
            bind:value={selectedModel}
            class="appearance-none pl-3 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          >
            {#if geminiModels.length > 0}
              <optgroup label="Google Gemini">
                {#each geminiModels as m}
                  <option value={m.id}>{m.displayName}</option>
                {/each}
              </optgroup>
            {/if}
            {#if claudeModels.length > 0}
              <optgroup label="Anthropic Claude">
                {#each claudeModels as m}
                  <option value={m.id}>{m.displayName}</option>
                {/each}
              </optgroup>
            {/if}
            {#if openaiModels.length > 0}
              <optgroup label="OpenAI">
                {#each openaiModels as m}
                  <option value={m.id}>{m.displayName}</option>
                {/each}
              </optgroup>
            {/if}
          </select>
          <ChevronDown
            class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
          />
        </div>
      {/if}

      {#if chatStore.messages.length > 0}
        <button
          onclick={clearHistory}
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Trash2 class="w-3 h-3" />
          Clear
        </button>
      {/if}

      <a
        href="/admin/settings"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Settings class="w-3 h-3" />
        AI Settings
      </a>
    </div>
  </div>

  <!-- Body -->
  <div class="flex-1 overflow-y-auto relative">
    <!-- No AI configured overlay -->
    {#if settingsChecked && !hasClaudeKey && !hasGeminiKey}
      <div
        class="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-10 p-6"
      >
        <div
          class="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4"
        >
          <Bot class="w-8 h-8 text-violet-500" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 mb-1">
          Connect AI to Start
        </h2>
        <p class="text-sm text-gray-500 text-center max-w-xs mb-5">
          Add a Claude or Gemini API key in your store settings to enable the AI
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
          class="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-200"
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
          <div class="grid grid-cols-2 gap-2 w-full max-w-md">
            {#each quickActions as qa}
              <button
                onclick={() => sendQuick(qa.text)}
                class="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-violet-300 hover:bg-violet-50 transition-colors"
              >
                {qa.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <!-- Chat messages -->
      <div class="px-4 py-4 space-y-4 max-w-3xl mx-auto w-full">
        {#each chatStore.messages as msg}
          {#if msg.role === "user"}
            <div class="flex justify-end">
              <div class="max-w-[75%]">
                {#if msg.file}
                  <div class="mb-1 flex justify-end">
                    {#if msg.file.preview}
                      <img
                        src={msg.file.preview}
                        alt={msg.file.name}
                        class="max-h-40 rounded-lg border border-gray-200 object-cover"
                      />
                    {:else}
                      <div
                        class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600"
                      >
                        <Paperclip class="w-3 h-3" />
                        {msg.file.name}
                      </div>
                    {/if}
                  </div>
                {/if}
                {#if msg.content}
                  <div
                    class="bg-violet-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
                  >
                    {msg.content}
                  </div>
                {/if}
              </div>
            </div>
          {:else}
            <div class="flex gap-3">
              <div
                class="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5"
              >
                <Bot class="w-3.5 h-3.5 text-white" />
              </div>
              <div
                class="max-w-[80%] bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-gray-800 leading-relaxed markdown-content"
              >
                {@html marked.parse(msg.content)}
              </div>
            </div>
          {/if}
        {/each}

        <!-- Typing indicator -->
        {#if sending}
          <div class="flex gap-3">
            <div
              class="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0"
            >
              <Bot class="w-3.5 h-3.5 text-white" />
            </div>
            <div
              class="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm"
            >
              <div class="flex gap-1 items-center h-4">
                <span
                  class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style="animation-delay: 0ms"
                ></span>
                <span
                  class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style="animation-delay: 150ms"
                ></span>
                <span
                  class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style="animation-delay: 300ms"
                ></span>
              </div>
            </div>
          </div>
        {/if}

        <div bind:this={chatEndEl}></div>
      </div>
    {/if}
  </div>

  <!-- Input area -->
  <div class="shrink-0 px-4 py-3 bg-white border-t border-gray-200">
    <div class="max-w-3xl mx-auto">
      <!-- File attachment preview -->
      {#if attachedFile}
        <div
          class="mb-2 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
        >
          {#if filePreview}
            <img
              src={filePreview}
              alt={attachedFile.name}
              class="h-10 w-10 rounded object-cover border border-gray-200"
            />
          {:else}
            <div
              class="w-10 h-10 rounded bg-violet-100 flex items-center justify-center"
            >
              <Paperclip class="w-4 h-4 text-violet-600" />
            </div>
          {/if}
          <span class="text-xs text-gray-600 flex-1 truncate"
            >{attachedFile.name}</span
          >
          <button
            onclick={removeAttachment}
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      {/if}

      <!-- Input row -->
      <div
        class="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all"
      >
        <!-- Paperclip -->
        <button
          onclick={() => fileInputEl?.click()}
          disabled={!models.length || !settingsChecked}
          class="mb-0.5 p-1.5 text-gray-400 hover:text-violet-600 disabled:opacity-30 transition-colors rounded-lg hover:bg-violet-50"
          title="Attach file"
        >
          <Paperclip class="w-4 h-4" />
        </button>

        <input
          bind:this={fileInputEl}
          type="file"
          accept="image/*,.csv,.xlsx,.xls"
          onchange={handleFileChange}
          class="hidden"
        />

        <!-- Textarea -->
        <textarea
          bind:this={textareaEl}
          bind:value={inputText}
          onkeydown={handleKeydown}
          disabled={sending || !models.length || !settingsChecked}
          placeholder={models.length
            ? "Ask me anything… (Shift+Enter for new line)"
            : "Configure AI keys in Settings to start"}
          rows="1"
          class="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none disabled:opacity-50 py-1 max-h-40 overflow-y-auto"
          style="field-sizing: content;"
        ></textarea>

        <!-- Send button -->
        <button
          onclick={sendMessage}
          disabled={sending ||
            (!inputText.trim() && !attachedFile) ||
            !selectedModel}
          class="mb-0.5 p-1.5 bg-violet-600 text-white rounded-xl disabled:opacity-30 hover:bg-violet-700 transition-colors"
        >
          <Send class="w-4 h-4" />
        </button>
      </div>

      <p class="text-center text-xs text-gray-400 mt-2">
        {#if models.length > 0}
          Using <span class="font-medium">{modelLabel(selectedModel)}</span>
          ·
          <span class="text-violet-500 font-medium"
            >🔗 Connected to {activeStore.name}</span
          >
          · AI can make mistakes — verify important info
        {:else if settingsChecked && (hasClaudeKey || hasGeminiKey || hasOpenaiKey)}
          Loading models…
        {:else if settingsChecked}
          No AI keys configured
        {/if}
      </p>
    </div>
  </div>
</div>

<style>
  .markdown-content :global(p) {
    margin-bottom: 0.75rem;
  }
  .markdown-content :global(p:last-child) {
    margin-bottom: 0;
  }
  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin-bottom: 0.75rem;
    padding-left: 1.25rem;
  }
  .markdown-content :global(ul) {
    list-style-type: disc;
  }
  .markdown-content :global(ol) {
    list-style-type: decimal;
  }
  .markdown-content :global(li) {
    margin-bottom: 0.25rem;
  }
  .markdown-content :global(strong) {
    font-weight: 600;
    color: #111827;
  }
  .markdown-content :global(code) {
    background-color: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 0.875em;
  }
</style>
