<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    Zap, LayoutDashboard, Package, Tag, Gift, Star,
    Bot, Settings, LogOut, MessageSquare, ShoppingCart,
    ChevronDown, Store
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { activeStore } from '$lib/stores/activeStore.svelte.js';

  let { children } = $props();

  // Reactive current path for sidebar highlighting
  const currentPath = $derived($page.url.pathname);

  // Hydrate as early as possible on the client
  if (browser) {
    activeStore.hydrate();
  }

  onMount(() => {
    if (!localStorage.getItem('pc_token')) {
      goto('/login');
      return;
    }
    
    // Redirect to last known path if at root admin and a store is selected
    // We do this in onMount to ensure goto works correctly with the router
    if (activeStore.slug && activeStore.lastPath && currentPath === '/admin') {
      if (activeStore.lastPath !== '/admin' && activeStore.lastPath !== '/admin/') {
        goto(activeStore.lastPath, { replaceState: true });
      }
    }
  });

  // Persist current path whenever it changes, if a store is active
  $effect(() => {
    // Only persist if it's a specific admin sub-page, not the store selector
    // We check that it starts with /admin/ and has something after it
    if (activeStore.slug && currentPath.length > 7 && currentPath.startsWith('/admin/') && currentPath !== '/admin/') {
      activeStore.setPath(currentPath);
    }
  });

  function logout() {
    localStorage.removeItem('pc_token');
    activeStore.clear();
    goto('/login');
  }

  function switchStore() {
    activeStore.clear();
    goto('/admin');
  }

  // Store-scoped nav (only shown when a store is active)
  const storeNav = [
    { href: '/admin/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
    { href: '/admin/products',   label: 'Products',    icon: Package },
    { href: '/admin/categories', label: 'Categories',  icon: Tag },
    { href: '/admin/promotions', label: 'Promotions',  icon: Gift },
    { href: '/admin/reviews',    label: 'Reviews',     icon: Star },
    { href: '/admin/orders',     label: 'Orders',      icon: ShoppingCart },
    { href: '/admin/chat',       label: 'Inbox',       icon: MessageSquare },
    { href: '/admin/ai',         label: 'AI Assistant',icon: Bot },
  ];

  // Always-visible bottom nav
  const globalNav = [
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(href + '/');
  }
</script>

<div class="flex h-screen bg-gray-50 overflow-hidden">
  <!-- Sidebar -->
  <aside class="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">

    <!-- Brand -->
    <div class="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
      <Zap class="w-4 h-4 text-yellow-400" />
      <span class="font-semibold text-sm text-gray-900">Store Admin</span>
    </div>

    <!-- Active store chip -->
    {#if activeStore.slug}
      <button
        onclick={switchStore}
        class="mx-3 mt-3 flex items-center justify-between gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-left hover:bg-blue-100 transition-colors group"
      >
        <div class="flex items-center gap-2 min-w-0">
          <Store class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span class="text-xs font-medium text-blue-800 truncate">{activeStore.name || activeStore.slug}</span>
        </div>
        <span class="text-xs text-blue-400 group-hover:text-blue-600 flex-shrink-0">Switch</span>
      </button>
    {:else}
      <a
        href="/admin"
        class="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100 transition-colors"
      >
        <Store class="w-3.5 h-3.5" />
        Select a store
      </a>
    {/if}

    <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
      {#if activeStore.slug}
        {#each storeNav as item}
          <a
            href={item.href}
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
              {isActive(item.href)
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
          >
            <item.icon class="w-4 h-4 flex-shrink-0" />
            {item.label}
          </a>
        {/each}
        <div class="my-2 border-t border-gray-100"></div>
      {/if}

      {#each globalNav as item}
        <a
          href={item.href}
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
            {isActive(item.href)
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
        >
          <item.icon class="w-4 h-4 flex-shrink-0" />
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="px-2 py-3 border-t border-gray-100">
      <button
        onclick={logout}
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 w-full transition-colors"
      >
        <LogOut class="w-4 h-4" />
        Sign out
      </button>
    </div>
  </aside>

  <!-- Main content -->
  <main class="flex-1 overflow-y-auto">
    {@render children()}
  </main>
</div>
