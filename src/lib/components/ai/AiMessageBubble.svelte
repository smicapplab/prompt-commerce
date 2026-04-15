<script lang="ts">
  import { Bot, Paperclip } from "@lucide/svelte";
  import { marked } from "marked";

  interface Props {
    role: "user" | "assistant";
    content: string;
    file?: {
      name: string;
      preview?: string;
    };
  }

  let { role, content, file }: Props = $props();
</script>

{#if role === "user"}
  <div class="flex justify-end">
    <div class="max-w-[75%]">
      {#if file}
        <div class="mb-1 flex justify-end">
          {#if file.preview}
            <img
              src={file.preview}
              alt={file.name}
              class="max-h-40 rounded-lg border border-gray-200 object-cover"
            />
          {:else}
            <div
              class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600"
            >
              <Paperclip class="w-3 h-3" />
              {file.name}
            </div>
          {/if}
        </div>
      {/if}
      {#if content}
        <div
          class="bg-violet-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
        >
          {content}
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="flex gap-3">
    <div
      class="w-7 h-7 rounded-full bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5"
    >
      <Bot class="w-3.5 h-3.5 text-white" />
    </div>
    <div
      class="max-w-[80%] bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-gray-800 leading-relaxed markdown-content"
    >
      {@html marked.parse(content)}
    </div>
  </div>
{/if}

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
