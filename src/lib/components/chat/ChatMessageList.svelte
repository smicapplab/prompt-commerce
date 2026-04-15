<script lang="ts">
  import { RefreshCw, Bot } from '@lucide/svelte';
  import type { Message } from "$lib/types/chat.js";
  import ChatMessageBubble from './ChatMessageBubble.svelte';

  interface Props {
    messages: Message[];
    buyerName: string;
    convLoading: boolean;
    messagesEnd?: HTMLDivElement | null;
  }

  let { messages, buyerName, convLoading, messagesEnd = $bindable() }: Props = $props();
</script>

<div class="flex-1 overflow-y-auto px-8 py-10 space-y-6 custom-scrollbar bg-gray-50/50">
  {#if convLoading}
    <div class="flex flex-col items-center justify-center py-24 gap-4">
      <RefreshCw size={32} class="animate-spin text-indigo-200" />
      <p class="text-[10px] font-black uppercase tracking-widest text-gray-300">Synchronizing thread content...</p>
    </div>
  {:else if messages.length === 0}
    <div class="text-center py-24 bg-white/50 rounded-3xl border border-dashed border-gray-200">
      <Bot size={48} class="text-gray-200 mx-auto mb-4" />
      <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Historical data stream is empty</p>
    </div>
  {:else}
    {#each messages as msg}
      <ChatMessageBubble {msg} {buyerName} />
    {/each}
    <div bind:this={messagesEnd}></div>
  {/if}
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #d1d5db;
  }
</style>
