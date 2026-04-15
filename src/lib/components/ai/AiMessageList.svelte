<script lang="ts">
  import { Bot } from "@lucide/svelte";
  import type { Message } from "$lib/stores/chatStore.svelte.js";
  import AiMessageBubble from "./AiMessageBubble.svelte";

  interface Props {
    messages: Message[];
    sending: boolean;
    chatEndEl: HTMLDivElement | undefined;
  }

  let { messages, sending, chatEndEl = $bindable() }: Props = $props();
</script>

<div class="px-4 py-4 space-y-4 max-w-3xl mx-auto w-full">
  {#each messages as msg}
    <AiMessageBubble role={msg.role} content={msg.content} file={msg.file} />
  {/each}

  <!-- Typing indicator -->
  {#if sending}
    <div class="flex gap-3">
      <div
        class="w-7 h-7 rounded-full bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0"
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
