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
    ChevronUp,
    User,
  } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";

  let { children } = $props();
  let userRole = $state("");
  let userName = $state("Admin");
  let isUserMenuOpen = $state(false);

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
        userName = payload.username || "Admin";
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

    // Close user menu on click outside
    const handleClickOutside = () => {
      if (isUserMenuOpen) isUserMenuOpen = false;
    };
    window.addEventListener("click", handleClickOutside);

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
      window.removeEventListener("click", handleClickOutside);
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
    { href: "/admin/profile", label: "My Profile", icon: User },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(href + "/");
  }
</script>

<div class="flex h-screen bg-gray-50 overflow-hidden">
  <!-- Sidebar -->
  <aside
    class="w-68 shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-[1px_0_0_0_rgba(0,0,0,0.05)] z-20"
  >
    <!-- Brand -->
    <div
      class="flex items-center gap-2.5 px-6 py-6 border-b border-gray-100/60"
    >
      <div
        class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-indigo-100 shadow-lg"
      >
        <ShoppingCart class="w-5 h-5" />
      </div>
      <div>
        <h1
          class="font-bold text-gray-900 tracking-tight text-lg leading-tight"
        >
          Prompt Commerce
        </h1>
        <p
          class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest"
        >
          Seller Admin
        </p>
      </div>
    </div>

    <!-- Active store chip -->
    <div class="px-4 py-5">
      {#if activeStore.slug}
        <button
          onclick={switchStore}
          class="w-full flex items-center justify-between gap-3 rounded-2xl bg-gray-50 border border-gray-200/80 p-3 text-left hover:bg-white hover:border-indigo-200 hover:shadow-sm hover:shadow-indigo-50/50 transition-all group active:scale-[0.98]"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-9 h-9 rounded-xl bg-white border border-gray-200 shadow-sm text-indigo-600 flex items-center justify-center shrink-0 group-hover:border-indigo-100 group-hover:bg-indigo-50 transition-colors overflow-hidden"
            >
              {#if activeStore.logo_url}
                <img
                  src={activeStore.logo_url}
                  alt={activeStore.name}
                  class="w-full h-full object-cover"
                />
              {:else}
                <Store class="w-5 h-5" />
              {/if}
            </div>
            <div class="min-w-0">
              <p
                class="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1"
              >
                Active Store
              </p>
              <h2
                class="text-sm font-bold text-gray-900 truncate leading-tight"
              >
                {activeStore.name || activeStore.slug}
              </h2>
            </div>
          </div>
          <div
            class="bg-gray-200/50 group-hover:bg-indigo-100 text-gray-400 group-hover:text-indigo-600 rounded-lg p-1 transition-colors"
          >
            <Settings class="w-3.5 h-3.5" />
          </div>
        </button>
      {:else}
        <a
          href="/admin"
          class="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-900 hover:bg-amber-100 hover:border-amber-200 transition-all group shadow-sm shadow-amber-50"
        >
          <div
            class="w-9 h-9 rounded-xl bg-white border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
          >
            <Store class="w-5 h-5" />
          </div>
          <div class="font-bold">Select a store to manage</div>
        </a>
      {/if}
    </div>

    <nav class="flex-1 overflow-y-auto px-4 pb-6 space-y-1 custom-scrollbar">
      {#if activeStore.slug}
        <div class="px-3 mb-2 mt-2">
          <p
            class="text-[11px] font-bold text-gray-400 uppercase tracking-widest"
          >
            Storefront
          </p>
        </div>
        {#each storeNav as item (item.href)}
          {@const active = isActive(item.href)}
          <a
            href={item.href}
            class="group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 active:scale-[0.98]
              {active
              ? 'bg-indigo-50 text-indigo-700 font-bold'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'}"
          >
            {#if active}
              <div
                class="absolute left-0 w-1 h-5 bg-indigo-600 rounded-r-full"
              ></div>
            {/if}
            <item.icon
              class="w-5 h-5 shrink-0 transition-colors {active
                ? 'text-indigo-600'
                : 'text-gray-400 group-hover:text-gray-700'}"
            />
            {item.label}

            {#if item.label === "Inbox" || item.label === "AI Assistant"}
              <div
                class="ml-auto w-1.5 h-1.5 rounded-full {active
                  ? 'bg-indigo-400'
                  : 'bg-gray-200 group-hover:bg-indigo-300'}"
              ></div>
            {/if}
          </a>
        {/each}
        <div class="my-6 border-t border-gray-100 mx-2 opacity-60"></div>
      {/if}

      <div class="px-3 mb-2 mt-2">
        <p
          class="text-[11px] font-bold text-gray-400 uppercase tracking-widest"
        >
          Account
        </p>
      </div>
      {#each globalNav as item (item.href)}
        {@const active = isActive(item.href)}
        <a
          href={item.href}
          class="group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 active:scale-[0.98]
            {active
            ? 'bg-indigo-50 text-indigo-700 font-bold'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'}"
        >
          {#if active}
            <div
              class="absolute left-0 w-1 h-5 bg-indigo-600 rounded-r-full"
            ></div>
          {/if}
          <item.icon
            class="w-5 h-5 shrink-0 transition-colors {active
              ? 'text-indigo-600'
              : 'text-gray-400 group-hover:text-gray-700'}"
          />
          {item.label}
        </a>
      {/each}
    </nav>

    <!-- Bottom User Block with Menu -->
    <div class="mt-auto p-4 border-t border-gray-100 bg-gray-50/40 relative">
      {#if isUserMenuOpen}
        <div
          transition:fade={{ duration: 100 }}
          class="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-2xl shadow-xl shadow-gray-200/50 overflow-hidden z-30"
        >
          <div class="p-2 space-y-1">
            <a
              href="/admin/profile"
              onclick={() => (isUserMenuOpen = false)}
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
            >
              <div
                class="w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-white flex items-center justify-center border border-transparent group-hover:border-indigo-100 transition-all"
              >
                <User class="w-4 h-4" />
              </div>
              My Profile
            </a>
            <div class="border-t border-gray-100 my-1 mx-2"></div>
            <button
              onclick={() => {
                isUserMenuOpen = false;
                logout();
              }}
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all group"
            >
              <div
                class="w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-white flex items-center justify-center border border-transparent group-hover:border-red-100 transition-all"
              >
                <LogOut class="w-4 h-4" />
              </div>
              Sign out
            </button>
          </div>
        </div>
      {/if}

      <button
        onclick={(e) => {
          e.stopPropagation();
          isUserMenuOpen = !isUserMenuOpen;
        }}
        class="w-full bg-white border border-gray-200 rounded-2xl p-3 shadow-sm hover:border-indigo-200 hover:shadow-indigo-50/50 transition-all group active:scale-[0.98] flex items-center justify-between gap-3"
      >
        <div class="flex items-center gap-3 min-w-0 text-left">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white shrink-0"
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div class="min-w-0">
            <h3
              class="text-sm font-bold text-gray-900 truncate leading-none mb-1"
            >
              {userName}
            </h3>
            <span
              class="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100/50"
            >
              {userRole.replace("_", " ")}
            </span>
          </div>
        </div>
        <ChevronUp
          class="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-all {isUserMenuOpen
            ? 'rotate-180'
            : ''}"
        />
      </button>
    </div>
  </aside>

  <!-- Main content -->
  <main class="flex-1 overflow-y-auto">
    {@render children()}
  </main>
</div>
