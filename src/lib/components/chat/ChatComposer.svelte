<script lang="ts">
  import { CircleCheck, RefreshCw, Send as SendIcon } from '@lucide/svelte';
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    newMessage: string;
    sending: boolean;
    onSend: () => void;
    status: string;
    onReopen: () => void;
  }

  let { newMessage = $bindable(), sending, onSend, status, onReopen }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }
</script>

<div class="p-8 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] shrink-0">
  {#if status === 'resolved'}
    <div class="flex items-center justify-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
      <CircleCheck size={18} class="text-emerald-500" />
      <p class="text-[10px] font-black uppercase tracking-widest text-emerald-600">This conversation is marked as resolved and closed.</p>
      <Button size="sm" variant="secondary" onclick={onReopen} class="ml-4 h-7 text-[9px] bg-white">Reopen to reply</Button>
    </div>
  {:else}
    <div class="flex gap-4 items-end max-w-5xl mx-auto">
      <div class="flex-1 relative">
        <textarea
          bind:value={newMessage}
          placeholder="Compose a response..."
          rows={1}
          onkeydown={handleKeydown}
          class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all min-h-14.5 max-h-48 font-medium custom-scrollbar"
        ></textarea>
        <div class="absolute right-4 bottom-4 flex items-center gap-2 text-gray-300">
          <span class="text-[9px] font-black uppercase tracking-widest">Type Message</span>
        </div>
      </div>
      <Button
        onclick={onSend}
        disabled={sending || !newMessage.trim()}
        variant="primary"
        class="h-14.5 w-14.5 rounded-2xl shadow-lg shadow-indigo-100 p-0 flex items-center justify-center"
      >
        {#if sending}
          <RefreshCw size={24} class="animate-spin" />
        {:else}
          <SendIcon size={24} class="rotate-45 -mt-1 ml-0.5" />
        {/if}
      </Button>
    </div>
    <div class="mt-4 flex items-center justify-center gap-6">
      <div class="flex items-center gap-2">
        <span class="text-[8px] font-black text-gray-400 leading-none uppercase tracking-widest">Enter to Dispatch</span>
        <kbd class="px-1.5 py-0.5 rounded bg-gray-100 text-[8px] font-black text-gray-500 border-b-2 border-gray-200">↵</kbd>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[8px] font-black text-gray-400 leading-none uppercase tracking-widest">Shift + Enter for Break</span>
      </div>
    </div>
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
