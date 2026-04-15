<script lang="ts">
  import { Search, RefreshCw, User, MessageCircle, ChevronLeft, ChevronRight } from '@lucide/svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import type { Conversation } from "$lib/types/chat.js";
  import ConversationRow from './ConversationRow.svelte';

  interface Props {
    conversations: Conversation[];
    totalCount: number;
    loading: boolean;
    selectedId?: number;
    q: string;
    filterStatus: string;
    page: number;
    totalPages: number;
    activeStoreSlug: string | null;
    onSearch: () => void;
    onSelect: (conv: Conversation) => void;
    onPageChange: (page: number) => void;
  }

  let { 
    conversations, 
    totalCount, 
    loading, 
    selectedId, 
    q = $bindable(), 
    filterStatus = $bindable(), 
    page = $bindable(), 
    totalPages,
    activeStoreSlug,
    onSearch,
    onSelect,
    onPageChange
  }: Props = $props();

</script>

<div class="w-96 border-r border-gray-100 flex flex-col shrink-0 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.02)]">
  <!-- Search & Filter Area -->
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-black text-gray-900 tracking-tight">Inbox</h1>
      <Badge variant="secondary" class="bg-indigo-50 text-indigo-600 border-none font-bold">
        {totalCount} Total
      </Badge>
    </div>

    <Input
      placeholder="Find buyers..."
      bind:value={q}
      onkeydown={(e) => e.key === 'Enter' && onSearch()}
      class="bg-gray-50/50 border-none rounded-2xl"
    >
      {#snippet icon()}
        <Search size={18} class="text-gray-400" />
      {/snippet}
    </Input>

    <div class="flex p-1 bg-gray-50/80 rounded-2xl gap-1">
      {#each [['open','Open'],['resolved','Resolved'],['','All']] as [s, label]}
        <button
          onclick={() => { filterStatus = s; onSearch(); }}
          class="flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all
          {filterStatus === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}"
        >{label}</button>
      {/each}
    </div>
  </div>

  <!-- Conversation Feed -->
  <div class="flex-1 overflow-y-auto custom-scrollbar">
    {#if loading}
      <div class="py-12 text-center">
        <RefreshCw size={24} class="animate-spin text-indigo-600 mx-auto mb-3" />
        <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Updating Feed...</p>
      </div>
    {:else if !activeStoreSlug}
      <div class="py-24 text-center px-10">
        <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
          <User size={32} />
        </div>
        <p class="text-sm font-medium text-gray-400">Select a store to view its customer messaging feed.</p>
      </div>
    {:else if conversations.length === 0}
      <div class="py-24 text-center px-10">
        <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
          <MessageCircle size={32} />
        </div>
        <h2 class="text-lg font-black text-gray-900 mb-2 uppercase tracking-tight">Quiet Here</h2>
        <p class="text-sm font-medium text-gray-400">No active conversations found matching your filters.</p>
      </div>
    {:else}
      {#each conversations as conv}
        <ConversationRow 
          {conv} 
          selected={selectedId === conv.id} 
          onclick={() => onSelect(conv)} 
        />
      {/each}

      <!-- Pager -->
      {#if totalPages > 1}
        <div class="flex items-center justify-between px-6 py-4 bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-t border-gray-50">
          <button onclick={() => onPageChange(page - 1)} disabled={page <= 1} class="hover:text-indigo-600 disabled:opacity-20 flex items-center gap-1">
            <ChevronLeft size={14} /> Prev
          </button>
          <span>{page} / {totalPages}</span>
          <button onclick={() => onPageChange(page + 1)} disabled={page >= totalPages} class="hover:text-indigo-600 disabled:opacity-20 flex items-center gap-1">
            Next <ChevronRight size={14} />
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>
