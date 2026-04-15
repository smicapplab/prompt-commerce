<script lang="ts">
  import { Bot, Trash2, Settings, ChevronDown } from "@lucide/svelte";
  import type { ModelOption } from "$lib/types/ai.js";

  interface Props {
    activeStoreName: string;
    models: ModelOption[];
    selectedModel: string;
    modelsLoading: boolean;
    hasMessages: boolean;
    onClear: () => void;
    geminiModels: ModelOption[];
    claudeModels: ModelOption[];
    openaiModels: ModelOption[];
  }

  let {
    activeStoreName,
    models,
    selectedModel = $bindable(),
    modelsLoading,
    hasMessages,
    onClear,
    geminiModels,
    claudeModels,
    openaiModels,
  }: Props = $props();
</script>

<div
  class="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0"
>
  <div class="flex items-center gap-3">
    <div
      class="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center"
    >
      <Bot class="w-4 h-4 text-white" />
    </div>
    <div>
      <h1 class="text-base font-bold text-gray-900">AI Assistant</h1>
      <p class="text-xs text-gray-500">{activeStoreName}</p>
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

    {#if hasMessages}
      <button
        onclick={onClear}
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
