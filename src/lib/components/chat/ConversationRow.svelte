<script lang="ts">
  import { User, Bot, Check } from '@lucide/svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import type { Conversation } from "$lib/types/chat.js";
  import { relativeTime } from '$lib/utils/format.js';
  import { channelIcon } from '$lib/utils/chat.js';

  interface Props {
    conv: Conversation;
    selected: boolean;
    onclick: (conv: Conversation) => void;
  }

  let { conv, selected, onclick }: Props = $props();

  const ChannelIcon = $derived(channelIcon(conv.channel));
</script>

<button
  onclick={() => onclick(conv)}
  class="w-full text-left px-6 py-5 border-b border-gray-50 hover:bg-gray-50/50 transition-all group relative
  {selected ? 'bg-indigo-50/30' : ''}"
>
  {#if selected}
    <div class="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full"></div>
  {/if}
  
  <div class="flex items-start justify-between gap-3 mb-2">
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-indigo-600 font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
        {(conv.buyer_name || conv.buyer_ref).charAt(0).toUpperCase()}
      </div>
      <div class="min-w-0">
        <span class="text-sm font-black text-gray-900 truncate block leading-none mb-1">
          {conv.buyer_name || conv.buyer_ref}
        </span>
        <div class="flex items-center gap-1.5">
          <ChannelIcon size={12} class="text-gray-300" />
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{conv.channel}</span>
        </div>
      </div>
    </div>
    <span class="text-[10px] font-bold text-gray-400 shrink-0 uppercase">{relativeTime(conv.last_message_at ?? conv.updated_at)}</span>
  </div>

  {#if conv.last_message}
    <p class="text-xs text-gray-500 line-clamp-2 leading-relaxed pl-13">
      {conv.last_message}
    </p>
  {/if}

  <div class="flex items-center gap-2 mt-4 pl-13">
    {#if conv.mode === 'human'}
      <Badge variant="secondary" class="bg-blue-50 text-blue-700 border-none font-bold text-[9px] uppercase px-2 py-0.5">
        <User size={10} class="mr-1" /> Human
      </Badge>
    {:else if conv.mode === 'ai'}
      <Badge variant="secondary" class="bg-purple-50 text-purple-700 border-none font-bold text-[9px] uppercase px-2 py-0.5">
        <Bot size={10} class="mr-1" /> Agentic AI
      </Badge>
    {:else}
      <Badge variant="secondary" class="bg-gray-50 text-gray-700 border-none font-bold text-[9px] uppercase px-2 py-0.5">
        <Check size={10} class="mr-1" /> System
      </Badge>
    {/if}
    
    {#if conv.status === 'resolved'}
      <Badge variant="secondary" class="bg-emerald-50 text-emerald-700 border-none font-bold text-[9px] uppercase px-2 py-0.5">
        Resolved
      </Badge>
    {/if}
    <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-auto">{conv.message_count} msgs</span>
  </div>
</button>
