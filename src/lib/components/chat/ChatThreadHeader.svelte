<script lang="ts">
  import { HandMetal, CircleCheck, RefreshCw } from '@lucide/svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import type { ConversationDetail } from "$lib/types/chat.js";
  import { channelIcon } from '$lib/utils/chat.js';

  interface Props {
    selectedConv: ConversationDetail;
    onTakeOver: () => void;
    onCloseSession: () => void;
    onReopen: () => void;
  }

  let { selectedConv, onTakeOver, onCloseSession, onReopen }: Props = $props();

  const SelectedChannelIcon = $derived(channelIcon(selectedConv.channel));
</script>

<div class="px-8 py-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm z-10 shrink-0">
  <div class="flex items-center gap-4">
    <div class="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-lg shadow-indigo-100">
      {(selectedConv.buyer_name || selectedConv.buyer_ref).charAt(0).toUpperCase()}
    </div>
    <div class="min-w-0">
      <p class="text-base font-black text-gray-900 leading-none mb-1.5 truncate">
        {selectedConv.buyer_name || selectedConv.buyer_ref}
      </p>
      <div class="flex items-center gap-2">
        <Badge variant="secondary" class="bg-gray-100 border-none font-bold text-[9px] uppercase px-2 py-0.5 inline-flex items-center gap-1">
          <SelectedChannelIcon size={10} /> {selectedConv.channel}
        </Badge>
        {#if selectedConv.buyer_name}
          <span class="text-gray-300">/</span>
          <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest font-mono">ID: {selectedConv.buyer_ref}</span>
        {/if}
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Active State</span>
      </div>
    </div>
  </div>

  <div class="flex items-center gap-2">
    {#if selectedConv.mode === 'ai'}
      <Button
        onclick={onTakeOver}
        variant="secondary"
        size="sm"
        class="bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100 font-black uppercase text-[10px] tracking-widest"
      >
        <HandMetal size={14} class="mr-2" /> Take Over
      </Button>
    {/if}
    
    {#if selectedConv.status === 'open'}
      <Button
        onclick={onCloseSession}
        variant="secondary"
        size="sm"
        class="font-black uppercase text-[10px] tracking-widest text-emerald-600 hover:bg-emerald-50"
      >
        <CircleCheck size={14} class="mr-2" /> Resolve
      </Button>
    {:else}
      <Button
        onclick={onReopen}
        variant="secondary"
        size="sm"
        class="font-black uppercase text-[10px] tracking-widest text-amber-600 hover:bg-amber-50"
      >
        <RefreshCw size={14} class="mr-2" /> Reopen
      </Button>
    {/if}
  </div>
</div>
