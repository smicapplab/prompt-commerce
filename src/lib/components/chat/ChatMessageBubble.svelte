<script lang="ts">
  import { Bot } from '@lucide/svelte';
  import type { Message } from "$lib/types/chat.js";
  import { formatTime } from '$lib/utils/format.js';

  interface Props {
    msg: Message;
    buyerName: string;
  }

  let { msg, buyerName }: Props = $props();

  const isSeller = $derived(msg.sender === 'seller');
  const isAi = $derived(msg.sender === 'ai');
  const isSystem = $derived(msg.sender === 'system');

  const senderLabel = $derived(
    isSeller 
      ? (msg.sender_name || 'Administrator') 
      : (isAi ? 'Agentic AI' : (buyerName || 'Customer'))
  );
</script>

{#if isSystem}
  <div class="flex justify-center my-6">
    <span class="px-5 py-1.5 bg-gray-200/50 backdrop-blur-sm rounded-full text-[9px] text-gray-500 font-black uppercase tracking-widest border border-gray-100 shadow-sm">
       {msg.body}
    </span>
  </div>
{:else}
  <div class="flex {isSeller ? 'justify-end' : 'justify-start'}">
    <div class="max-w-[80%] lg:max-w-2xl">
      <div class="flex items-center gap-2 mb-1.5 {isSeller ? 'flex-row-reverse space-x-reverse' : ''}">
        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">
           {senderLabel}
        </span>
        <span class="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">{formatTime(msg.created_at)}</span>
      </div>
      
      <div class="relative group">
        <div class="rounded-3xl px-5 py-3 shadow-sm {isSeller 
          ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100' 
          : 'bg-white text-gray-900 border border-gray-100 rounded-tl-none shadow-gray-200/40'} 
          {isAi ? 'bg-purple-50 text-purple-900 border-purple-200 shadow-purple-100' : ''}">
          <p class="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        </div>
        
        {#if isAi}
          <div class="absolute -right-2 -bottom-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow-lg">
            <Bot size={12} />
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
