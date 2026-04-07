<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    LayoutDashboard,
    Package,
    Tag,
    Gift,
    Star,
    Bot,
    Settings,
    LogOut,
    MessageSquare,
    ShoppingCart,
    Store,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";

  let { children } = $props();
  let userRole = $state("");

  // Reactive current path for sidebar highlighting
  const currentPath = $derived($page.url.pathname);

  // Hydrate as early as possible on the client
  if (browser) {
    activeStore.hydrate();
    const token = localStorage.getItem("pc_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        userRole = payload.role;
      } catch (e) {}
    }
  }

  let activityTimeout: any;
  const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

  function resetActivity() {
    if (!browser || !localStorage.getItem("pc_token")) return;
    localStorage.setItem("pc_last_activity", Date.now().toString());
  }

  function checkActivity() {
    if (!browser || !localStorage.getItem("pc_token")) return;
    const last = parseInt(localStorage.getItem("pc_last_activity") || "0", 10);
    if (Date.now() - last > IDLE_TIMEOUT_MS) {
      logout();
    }
  }

  onMount(() => {
    if (!localStorage.getItem("pc_token")) {
      goto("/login");
      return;
    }

    resetActivity();

    // Activity tracking
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];
    const handleActivity = () => resetActivity();
    activityEvents.forEach((e) =>
      window.addEventListener(e, handleActivity, { passive: true }),
    );

    activityTimeout = setInterval(checkActivity, 60000); // Check every minute

    // Redirect to last known path if at root admin and a store is selected
    // We do this in onMount to ensure goto works correctly with the router
    if (activeStore.slug && activeStore.lastPath && currentPath === "/admin") {
      if (
        activeStore.lastPath !== "/admin" &&
        activeStore.lastPath !== "/admin/"
      ) {
        goto(activeStore.lastPath, { replaceState: true });
      }
    }

    return () => {
      activityEvents.forEach((e) =>
        window.removeEventListener(e, handleActivity),
      );
      clearInterval(activityTimeout);
    };
  });

  // Persist current path whenever it changes, if a store is active
  $effect(() => {
    // Only persist if it's a specific admin sub-page, not the store selector
    // We check that it starts with /admin/ and has something after it
    if (
      activeStore.slug &&
      currentPath.length > 7 &&
      currentPath.startsWith("/admin/") &&
      currentPath !== "/admin/"
    ) {
      activeStore.setPath(currentPath);
    }
  });

  function logout() {
    localStorage.removeItem("pc_token");
    activeStore.clear();
    goto("/login");
  }

  function switchStore() {
    activeStore.clear();
    goto("/admin?switch=1");
  }

  // Store-scoped nav (only shown when a store is active)
  const allStoreNav = [
    {
      href: "/admin/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "super_admin", "store_admin"],
    },
    {
      href: "/admin/products",
      label: "Products",
      icon: Package,
      roles: ["admin", "super_admin", "store_admin", "merchandising"],
    },
    {
      href: "/admin/categories",
      label: "Categories",
      icon: Tag,
      roles: ["admin", "super_admin", "store_admin", "merchandising"],
    },
    {
      href: "/admin/promotions",
      label: "Promotions",
      icon: Gift,
      roles: ["admin", "super_admin", "store_admin", "merchandising"],
    },
    {
      href: "/admin/reviews",
      label: "Reviews",
      icon: Star,
      roles: ["admin", "super_admin", "store_admin", "merchandising"],
    },
    {
      href: "/admin/orders",
      label: "Orders",
      icon: ShoppingCart,
      roles: ["admin", "super_admin", "store_admin", "ops"],
    },
    {
      href: "/admin/chat",
      label: "Inbox",
      icon: MessageSquare,
      roles: ["admin", "super_admin", "store_admin", "ops"],
    },
    {
      href: "/admin/ai",
      label: "AI Assistant",
      icon: Bot,
      roles: ["admin", "super_admin", "store_admin"],
    },
  ];

  const storeNav = $derived(
    allStoreNav.filter((n) => !n.roles || n.roles.includes(userRole)),
  );

  // Always-visible bottom nav
  const globalNav = [
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(href + "/");
  }
</script>

<div class="flex h-screen bg-gray-50 overflow-hidden">
  <!-- Sidebar -->
  <aside class="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
    <!-- Brand -->
    <div class="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
      <img src="/logo-2.png" alt="Prompt Commerce" class="h-8" />
      <span class="font-semibold text-sm text-cyan-800 pt-2">Store Admin</span>
    </div>

    <!-- Active store chip -->
    {#if activeStore.slug}
      <button
        onclick={switchStore}
        class="mx-3 mt-3 flex items-center justify-between gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-left hover:bg-blue-100 transition-colors group"
      >
        <div class="flex items-center gap-2 min-w-0">
          <Store class="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span class="text-xs font-medium text-blue-800 truncate"
            >{activeStore.name || activeStore.slug}</span
          >
        </div>
        <span class="text-xs text-blue-400 group-hover:text-blue-600 shrink-0"
          >Switch</span
        >
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
            <item.icon class="w-4 h-4 shrink-0" />
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
          <item.icon class="w-4 h-4 shrink-0" />
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="px-2 py-3 border-t border-gray-100">
      <button
        onclick={logout}
        class="flex justify-center items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 w-full transition-colors"
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
