<script lang="ts">
  import { onMount, tick, onDestroy } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';
  import { MessageCircle } from '@lucide/svelte';

  import type { Conversation, ConversationDetail } from "$lib/types/chat.js";
  
  // New Components
  import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';
  import ChatThreadHeader from '$lib/components/chat/ChatThreadHeader.svelte';
  import ChatMessageList from '$lib/components/chat/ChatMessageList.svelte';
  import ChatComposer from '$lib/components/chat/ChatComposer.svelte';

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

  async function takeOver(conv: ConversationDetail) {
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

  async function closeSession(conv: ConversationDetail) {
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

  onMount(async () => {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) currentUser = await res.json();
  });

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
  <ChatSidebar 
    {conversations}
    {totalCount}
    {loading}
    selectedId={selectedConv?.id}
    bind:q={q}
    bind:filterStatus={filterStatus}
    bind:page={page}
    {totalPages}
    activeStoreSlug={activeStore.slug}
    onSearch={handleSearch}
    onSelect={openConversation}
    onPageChange={(p) => { page = p; load(); }}
  />

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
      <ChatThreadHeader 
        {selectedConv}
        onTakeOver={() => takeOver(selectedConv!)}
        onCloseSession={() => closeSession(selectedConv!)}
        onReopen={() => setConvStatus(selectedConv!.id, 'open')}
      />

      <ChatMessageList 
        messages={selectedConv.messages}
        buyerName={selectedConv.buyer_name || selectedConv.buyer_ref}
        convLoading={convLoading}
        bind:messagesEnd={messagesEnd}
      />

      <ChatComposer 
        bind:newMessage={newMessage}
        sending={sending}
        onSend={sendMessage}
        status={selectedConv.status}
        onReopen={() => setConvStatus(selectedConv!.id, 'open')}
      />
    {/if}
  </div>
</div>
