<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';
  import { 
    Send as SendIcon, 
    MessageCircle, 
    Mail, 
    User, 
    Bot, 
    Check, 
    Search, 
    Clock, 
    ChevronLeft, 
    ChevronRight,
    RefreshCw,
    MoreVertical,
    CheckCircle2,
    XCircle,
    HandMetal
  } from '@lucide/svelte';

  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Input from '$lib/components/ui/Input.svelte';

  import type { Conversation, ConversationDetail, Message } from "$lib/types/chat.js";

  let conversations = $state<Conversation[]>([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let page = $state(1);
  const limit = 30;
  let q = $state('');
  let filterStatus = $state('open');

  let selectedConv = $state<ConversationDetail | null>(null);
  let convLoading = $state(false);
  let newMessage = $state('');
  let sending = $state(false);
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  let messagesEnd = $state<HTMLDivElement | null>(null);
  let currentUser = $state<{ username: string } | null>(null);

  const token = () => localStorage.getItem('pc_token') ?? '';

  async function load(sid = activeStore.slug) {
    if (!sid) return;
    loading = true;
    const params = new URLSearchParams({ store: sid, page: String(page), limit: String(limit), q, status: filterStatus });
    const res = await fetch(`/api/conversations?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
    loading = false;
    if (res.ok) {
      const data = await res.json();
      conversations = data.conversations;
      totalCount = data.totalCount;
    }
  }

  async function openConversation(conv: Conversation) {
    convLoading = true;
    selectedConv = { ...conv, messages: [] };
    const res = await fetch(`/api/conversations/${conv.id}?store=${activeStore.slug}`, { headers: { Authorization: `Bearer ${token()}` } });
    convLoading = false;
    if (res.ok) {
      selectedConv = await res.json();
      await tick();
      scrollToBottom();
    }
    startPolling(conv.id);
  }

  async function refreshMessages() {
    if (!selectedConv) return;
    const lastMsgId = selectedConv.messages.length > 0 ? selectedConv.messages[selectedConv.messages.length - 1].id : 0;
    const res = await fetch(`/api/conversations/${selectedConv.id}?store=${activeStore.slug}&since_id=${lastMsgId}`, { 
      headers: { Authorization: `Bearer ${token()}` } 
    });
    if (res.ok) {
      const data = await res.json();
      if (data.messages.length > 0) {
        selectedConv.messages = [...selectedConv.messages, ...data.messages];
        // Update basic conversation metadata
        const { messages, incremental, ...meta } = data;
        Object.assign(selectedConv, meta);
        
        await tick();
        scrollToBottom();
      }
    }
  }

  function startPolling(id: number) {
    stopPolling();
    pollingTimer = setInterval(async () => {
      if (selectedConv?.id === id) await refreshMessages();
    }, 5000);
  }

  function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConv || sending) return;
    sending = true;
    const body = newMessage.trim();
    newMessage = '';
    const res = await fetch(`/api/conversations/${selectedConv.id}/messages?store=${activeStore.slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ body, sender: 'seller', sender_name: currentUser?.username })
    });
    sending = false;
    if (res.ok) {
      const msg = await res.json();
      selectedConv = { ...selectedConv, messages: [...selectedConv.messages, msg] };
      // Update last message in list
      conversations = conversations.map(c =>
        c.id === selectedConv!.id ? { ...c, last_message: body, last_message_at: msg.created_at } : c
      );
      await tick();
      scrollToBottom();
    }
  }

  async function takeOver(conv: Conversation) {
    if (!currentUser) return;
    const res = await fetch(`/api/conversations/${conv.id}?store=${activeStore.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ mode: 'human', assigned_to: currentUser.username })
    });
    if (res.ok) {
      const updated = await res.json();
      conversations = conversations.map(c => c.id === conv.id ? { ...c, ...updated } : c);
      if (selectedConv?.id === conv.id) {
        selectedConv = { ...selectedConv, ...updated };
        await refreshMessages();
      }
    }
  }

  async function closeSession(conv: Conversation) {
    const res = await fetch(`/api/conversations/${conv.id}?store=${activeStore.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status: 'resolved', mode: 'closed' })
    });
    if (res.ok) {
      const updated = await res.json();
      conversations = conversations.map(c => c.id === conv.id ? { ...c, ...updated } : c);
      if (selectedConv?.id === conv.id) {
        selectedConv = { ...selectedConv, ...updated };
        await refreshMessages();
      }
    }
  }

  async function setConvStatus(id: number, status: string) {
    await fetch(`/api/conversations/${id}?store=${activeStore.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status })
    });
    conversations = conversations.map(c => c.id === id ? { ...c, status } : c);
    if (selectedConv?.id === id) selectedConv = { ...selectedConv, status };
  }

  function scrollToBottom() {
    messagesEnd?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSearch() { page = 1; await load(); }
  const totalPages = $derived(Math.ceil(totalCount / limit));

  function relativeTime(d: string | null) {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }

  function channelIcon(ch: string) {
    if (ch === 'telegram') return SendIcon;
    if (ch === 'whatsapp') return MessageCircle;
    return Mail;
  }

  onMount(async () => {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) currentUser = await res.json();
  });

  import { onDestroy } from 'svelte';
  onDestroy(() => {
    stopPolling();
  });

  $effect(() => {
    const slug = activeStore.slug;
    if (slug) {
      page = 1;
      selectedConv = null;
      stopPolling();
      load(slug);
    }
  });
</script>

<svelte:head>
  <title>Inbox — {activeStore.name || 'Prompt Commerce'}</title>
</svelte:head>

<div class="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
  <!-- Sidebar: Conversation List -->
  <div class="w-96 border-r border-gray-100 flex flex-col flex-shrink-0 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.02)]">
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
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
        class="bg-gray-50/50 border-none rounded-2xl"
      >
        {#snippet icon()}
          <Search size={18} class="text-gray-400" />
        {/snippet}
      </Input>

      <div class="flex p-1 bg-gray-50/80 rounded-2xl gap-1">
        {#each [['open','Open'],['resolved','Resolved'],['','All']] as [s, label]}
          <button
            onclick={() => { filterStatus = s; handleSearch(); }}
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
      {:else if !activeStore.slug}
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
          {@const ChannelIcon = channelIcon(conv.channel)}
          <button
            onclick={() => openConversation(conv)}
            class="w-full text-left px-6 py-5 border-b border-gray-50 hover:bg-gray-50/50 transition-all group relative
            {selectedConv?.id === conv.id ? 'bg-indigo-50/30' : ''}"
          >
            {#if selectedConv?.id === conv.id}
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
              <span class="text-[10px] font-bold text-gray-400 flex-shrink-0 uppercase">{relativeTime(conv.last_message_at ?? conv.updated_at)}</span>
            </div>

            {#if conv.last_message}
              <p class="text-xs text-gray-500 line-clamp-2 leading-relaxed pl-[52px]">
                {conv.last_message}
              </p>
            {/if}

            <div class="flex items-center gap-2 mt-4 pl-[52px]">
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
        {/each}

        <!-- Pager -->
        {#if totalPages > 1}
          <div class="flex items-center justify-between px-6 py-4 bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-t border-gray-50">
            <button onclick={() => { page--; load(); }} disabled={page <= 1} class="hover:text-indigo-600 disabled:opacity-20 flex items-center gap-1">
              <ChevronLeft size={14} /> Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button onclick={() => { page++; load(); }} disabled={page >= totalPages} class="hover:text-indigo-600 disabled:opacity-20 flex items-center gap-1">
              Next <ChevronRight size={14} />
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Content: Message Thread -->
  <div class="flex-1 flex flex-col bg-gray-50/30">
    {#if !selectedConv}
      <div class="flex-1 flex flex-col items-center justify-center text-center p-10">
        <div class="w-24 h-24 bg-white rounded-3xl shadow-[0_20px_50px_rgba(79,70,229,0.1)] flex items-center justify-center text-indigo-500 mb-8 animate-bounce transition-all duration-1000">
          <MessageCircle size={48} strokeWidth={1.5} />
        </div>
        <h2 class="text-2xl font-black text-gray-900 tracking-tight mb-2">Omnichannel Inbox</h2>
        <p class="text-sm font-medium text-gray-400 max-w-sm leading-relaxed">
          Select a conversation from the sidebar to manage customer queries, take over from AI, or close resolved sessions.
        </p>
      </div>
    {:else}
      <!-- thread Header -->
      {@const SelectedChannelIcon = channelIcon(selectedConv.channel)}
      <div class="px-8 py-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm z-10">
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
              onclick={() => takeOver(selectedConv!)}
              variant="secondary"
              size="sm"
              class="bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100 font-black uppercase text-[10px] tracking-widest"
            >
              <HandMetal size={14} class="mr-2" /> Take Over
            </Button>
          {/if}
          
          {#if selectedConv.status === 'open'}
            <Button
              onclick={() => closeSession(selectedConv!)}
              variant="secondary"
              size="sm"
              class="font-black uppercase text-[10px] tracking-widest text-emerald-600 hover:bg-emerald-50"
            >
              <CheckCircle2 size={14} class="mr-2" /> Resolve
            </Button>
          {:else}
            <Button
              onclick={() => setConvStatus(selectedConv!.id, 'open')}
              variant="secondary"
              size="sm"
              class="font-black uppercase text-[10px] tracking-widest text-amber-600 hover:bg-amber-50"
            >
              <RefreshCw size={14} class="mr-2" /> Reopen
            </Button>
          {/if}
        </div>
      </div>

      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto px-8 py-10 space-y-6 custom-scrollbar bg-gray-50/50">
        {#if convLoading}
          <div class="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw size={32} class="animate-spin text-indigo-200" />
            <p class="text-[10px] font-black uppercase tracking-widest text-gray-300">Synchronizing thread content...</p>
          </div>
        {:else if selectedConv.messages.length === 0}
          <div class="text-center py-24 bg-white/50 rounded-3xl border border-dashed border-gray-200">
            <Bot size={48} class="text-gray-200 mx-auto mb-4" />
            <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Historical data stream is empty</p>
          </div>
        {:else}
          {#each selectedConv.messages as msg}
            {#if msg.sender === 'system'}
              <div class="flex justify-center my-6">
                <span class="px-5 py-1.5 bg-gray-200/50 backdrop-blur-sm rounded-full text-[9px] text-gray-500 font-black uppercase tracking-widest border border-gray-100 shadow-sm">
                   {msg.body}
                </span>
              </div>
            {:else}
              <div class="flex {msg.sender === 'seller' ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[80%] lg:max-w-2xl">
                  <div class="flex items-center gap-2 mb-1.5 {msg.sender === 'seller' ? 'flex-row-reverse space-x-reverse' : ''}">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                       {msg.sender === 'seller' ? (msg.sender_name || 'Administrator') : (msg.sender === 'ai' ? 'Agentic AI' : (selectedConv.buyer_name || 'Customer'))}
                    </span>
                    <span class="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">{formatTime(msg.created_at)}</span>
                  </div>
                  
                  <div class="relative group">
                    <div class="rounded-3xl px-5 py-3 shadow-sm {msg.sender === 'seller' 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100' 
                      : 'bg-white text-gray-900 border border-gray-100 rounded-tl-none shadow-gray-200/40'} 
                      {msg.sender === 'ai' ? 'bg-purple-50 text-purple-900 border-purple-200 shadow-purple-100' : ''}">
                      <p class="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    </div>
                    
                    {#if msg.sender === 'ai'}
                      <div class="absolute -right-2 -bottom-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow-lg">
                        <Bot size={12} />
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          {/each}
          <div bind:this={messagesEnd}></div>
        {/if}
      </div>

      <!-- Footer Composing -->
      <div class="p-8 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
        {#if selectedConv.status === 'resolved'}
          <div class="flex items-center justify-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <CheckCircle2 size={18} class="text-emerald-500" />
            <p class="text-[10px] font-black uppercase tracking-widest text-emerald-600">This conversation is marked as resolved and closed.</p>
            <Button size="sm" variant="secondary" onclick={() => setConvStatus(selectedConv!.id, 'open')} class="ml-4 h-7 text-[9px] bg-white">Reopen to reply</Button>
          </div>
        {:else}
          <div class="flex gap-4 items-end max-w-5xl mx-auto">
            <div class="flex-1 relative">
              <textarea
                bind:value={newMessage}
                placeholder="Compose a response..."
                rows={1}
                onkeydown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all min-h-[58px] max-h-48 font-medium custom-scrollbar"
              ></textarea>
              <div class="absolute right-4 bottom-4 flex items-center gap-2 text-gray-300">
                <span class="text-[9px] font-black uppercase tracking-widest">Type Message</span>
              </div>
            </div>
            <Button
              onclick={sendMessage}
              disabled={sending || !newMessage.trim()}
              variant="primary"
              class="h-[58px] w-[58px] rounded-2xl shadow-lg shadow-indigo-100 p-0 flex items-center justify-center"
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
    {/if}
  </div>
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
  
  :global(.custom-scrollbar) {
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
  }
</style>
