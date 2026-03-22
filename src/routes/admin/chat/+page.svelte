<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';

  interface Message {
    id: number;
    conversation_id: number;
    sender: string;
    body: string;
    created_at: string;
  }

  interface Conversation {
    id: number;
    store: number;
    buyer_ref: string;
    channel: string;
    status: string;
    last_message: string | null;
    last_message_at: string | null;
    message_count: number;
    created_at: string;
    updated_at: string;
  }

  interface ConversationDetail extends Conversation {
    messages: Message[];
  }

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
    const res = await fetch(`/api/conversations/${selectedConv.id}?store=${activeStore.slug}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) {
      const data = await res.json();
      const prevCount = selectedConv.messages.length;
      selectedConv = data;
      if (data.messages.length !== prevCount) {
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
      body: JSON.stringify({ body, sender: 'seller' })
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

  async function search() { page = 1; await load(); }
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
    if (ch === 'telegram') return '✈';
    if (ch === 'whatsapp') return '💬';
    return '📨';
  }

  onMount(() => {
    if (activeStore.slug) { load(activeStore.slug); }
    return () => {
      stopPolling();
    };
  });
</script>

<svelte:head><title>Inbox — Prompt Commerce</title></svelte:head>

<!-- Full-height two-panel inbox -->
<div class="flex h-full overflow-hidden">
  <!-- Left: Conversation List -->
  <div class="w-80 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200">
      <div class="mb-3">
        <h1 class="text-sm font-semibold text-gray-900">Inbox</h1>
      </div>
      <input
        type="search"
        placeholder="Search buyers…"
        bind:value={q}
        onkeydown={(e) => e.key === 'Enter' && search()}
        class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div class="flex gap-1 mt-2">
        {#each [['open','Open'],['resolved','Resolved'],['','All']] as [s, label]}
          <button
            onclick={() => { filterStatus = s; search(); }}
            class="flex-1 rounded-md py-1 text-xs font-medium transition-colors {filterStatus === s ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}"
          >{label}</button>
        {/each}
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="py-8 text-center text-sm text-gray-400">Loading…</div>
      {:else if !activeStore.slug}
        <div class="py-8 text-center text-sm text-gray-400">Select a store</div>
      {:else if conversations.length === 0}
        <div class="py-8 text-center text-sm text-gray-400">No conversations found.</div>
      {:else}
        {#each conversations as conv}
          <button
            onclick={() => openConversation(conv)}
            class="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors {selectedConv?.id === conv.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-base leading-none flex-shrink-0">{channelIcon(conv.channel)}</span>
                <span class="text-sm font-medium text-gray-900 truncate">{conv.buyer_ref}</span>
              </div>
              <span class="text-xs text-gray-400 flex-shrink-0">{relativeTime(conv.last_message_at ?? conv.updated_at)}</span>
            </div>
            {#if conv.last_message}
              <p class="text-xs text-gray-500 mt-1 truncate pl-5">{conv.last_message}</p>
            {/if}
            <div class="flex items-center gap-2 mt-1.5 pl-5">
              {#if conv.status === 'resolved'}
                <span class="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">Resolved</span>
              {:else}
                <span class="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Open</span>
              {/if}
              <span class="text-xs text-gray-400">{conv.message_count} msgs</span>
            </div>
          </button>
        {/each}

        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="flex justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <button onclick={() => { page--; load(); }} disabled={page <= 1} class="hover:text-gray-700 disabled:opacity-40">← Prev</button>
            <span>{page}/{totalPages}</span>
            <button onclick={() => { page++; load(); }} disabled={page >= totalPages} class="hover:text-gray-700 disabled:opacity-40">Next →</button>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Right: Message Thread -->
  <div class="flex-1 flex flex-col bg-gray-50 min-w-0">
    {#if !selectedConv}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center text-gray-400">
          <div class="text-4xl mb-3">💬</div>
          <p class="text-sm">Select a conversation to start</p>
        </div>
      </div>
    {:else}
      <!-- Thread Header -->
      <div class="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700">
            {selectedConv.buyer_ref.charAt(0).toUpperCase()}
          </div>
          <div>
            <p class="text-sm font-semibold text-gray-900">{selectedConv.buyer_ref}</p>
            <p class="text-xs text-gray-500 capitalize">{channelIcon(selectedConv.channel)} {selectedConv.channel}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          {#if selectedConv.status === 'open'}
            <button
              onclick={() => setConvStatus(selectedConv!.id, 'resolved')}
              class="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >Mark resolved</button>
          {:else}
            <button
              onclick={() => setConvStatus(selectedConv!.id, 'open')}
              class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >Reopen</button>
          {/if}
        </div>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {#if convLoading}
          <div class="text-center text-sm text-gray-400 py-8">Loading…</div>
        {:else if selectedConv.messages.length === 0}
          <div class="text-center text-sm text-gray-400 py-8">No messages yet.</div>
        {:else}
          {#each selectedConv.messages as msg}
            <div class="flex {msg.sender === 'seller' ? 'justify-end' : 'justify-start'}">
              <div class="max-w-xs lg:max-w-md">
                {#if msg.sender !== 'seller'}
                  <p class="text-xs text-gray-500 mb-1 ml-1">{selectedConv.buyer_ref}</p>
                {/if}
                <div class="rounded-2xl px-4 py-2.5 {msg.sender === 'seller' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm shadow-sm'} {msg.sender === 'ai' ? 'bg-purple-50 text-purple-900 border-purple-200' : ''}">
                  <p class="text-sm whitespace-pre-wrap">{msg.body}</p>
                </div>
                <div class="flex items-center gap-1 mt-1 {msg.sender === 'seller' ? 'justify-end mr-1' : 'ml-1'}">
                  {#if msg.sender === 'ai'}
                    <span class="text-xs text-purple-400">🤖 AI</span>
                  {/if}
                  <span class="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            </div>
          {/each}
          <div bind:this={messagesEnd}></div>
        {/if}
      </div>

      <!-- Compose -->
      <div class="px-5 py-3 bg-white border-t border-gray-200">
        <div class="flex gap-3 items-end">
          <textarea
            bind:value={newMessage}
            placeholder="Type a message…"
            rows={1}
            onkeydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            class="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px] max-h-32"
          ></textarea>
          <button
            onclick={sendMessage}
            disabled={sending || !newMessage.trim()}
            class="rounded-xl bg-indigo-600 px-4 py-2.5 text-white hover:bg-indigo-700 disabled:opacity-40 flex-shrink-0"
          >
            {#if sending}
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            {:else}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            {/if}
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    {/if}
  </div>
</div>
