<script lang="ts">
  import { Paperclip, Send, X, Link2 } from "@lucide/svelte";

  interface AttachedFile {
    data: string;
    mimeType: string;
    name: string;
  }

  interface Props {
    inputText: string;
    attachedFile: AttachedFile | null;
    filePreview: string | null;
    sending: boolean;
    onSend: () => void;
    hasModels: boolean;
    settingsChecked: boolean;
    selectedModel: string;
    selectedModelLabel: string;
    activeStoreName: string;
  }

  let {
    inputText = $bindable(),
    attachedFile = $bindable(),
    filePreview = $bindable(),
    sending,
    onSend,
    hasModels,
    settingsChecked,
    selectedModel,
    selectedModelLabel,
    activeStoreName,
  }: Props = $props();

  let fileInputEl = $state<HTMLInputElement>();
  let textareaEl = $state<HTMLTextAreaElement>();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const [header, data] = result.split(",");
      const mimeType = header.split(":")[1].split(";")[0];
      attachedFile = { data, mimeType, name: file.name };

      if (mimeType.startsWith("image/")) {
        filePreview = result;
      } else {
        filePreview = null;
      }
    };
    reader.readAsDataURL(file);
    (e.target as HTMLInputElement).value = "";
  }

  function removeAttachment() {
    attachedFile = null;
    filePreview = null;
  }

  export function focus() {
    textareaEl?.focus();
  }
</script>

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
        disabled={!hasModels || !settingsChecked}
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
        disabled={sending || !hasModels || !settingsChecked}
        placeholder={hasModels
          ? "Ask me anything… (Shift+Enter for new line)"
          : "Configure AI keys in Settings to start"}
        rows="1"
        class="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none disabled:opacity-50 py-1 max-h-40 overflow-y-auto"
        style="field-sizing: content;"
      ></textarea>

      <!-- Send button -->
      <button
        onclick={onSend}
        disabled={sending ||
          (!inputText.trim() && !attachedFile) ||
          !selectedModel}
        class="mb-0.5 p-1.5 bg-violet-600 text-white rounded-xl disabled:opacity-30 hover:bg-violet-700 transition-colors"
      >
        <Send class="w-4 h-4" />
      </button>
    </div>

    <p class="text-center text-xs text-gray-400 mt-2">
      {#if hasModels}
        Using <span class="font-medium">{selectedModelLabel}</span>
        ·
        <span class="text-violet-500 font-medium inline-flex items-center gap-1"
          ><Link2 class="w-3 h-3" /> Connected to {activeStoreName}</span
        >
        · AI can make mistakes — verify important info
      {:else if settingsChecked}
        No AI keys configured
      {/if}
    </p>
  </div>
</div>
