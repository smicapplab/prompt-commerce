<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import {
    Package,
    Tag,
    Gift,
    Star,
    ShoppingCart,
    MessageSquare,
  } from "@lucide/svelte";

  interface Stats {
    products: number;
    categories: number;
    promotions: number;
    reviews: number;
    orders: number;
    conversations: number;
  }

  let stats = $state<Stats | null>(null);
  let loading = $state(true);
  let error = $state("");

  function token() {
    return localStorage.getItem("pc_token") ?? "";
  }

  const statCards = [
    {
      label: "Products",
      key: "products",
      icon: Package,
      href: "/admin/products",
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Categories",
      key: "categories",
      icon: Tag,
      href: "/admin/categories",
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Promotions",
      key: "promotions",
      icon: Gift,
      href: "/admin/promotions",
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Reviews",
      key: "reviews",
      icon: Star,
      href: "/admin/reviews",
      color: "bg-yellow-50 text-yellow-600",
    },
    {
      label: "Orders",
      key: "orders",
      icon: ShoppingCart,
      href: "/admin/orders",
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Conversations",
      key: "conversations",
      icon: MessageSquare,
      href: "/admin/chat",
      color: "bg-pink-50 text-pink-600",
    },
  ];

  onMount(async () => {
    if (!activeStore.id) {
      goto("/admin");
      return;
    }
    loading = true;
    const res = await fetch(`/api/stores/${activeStore.id}/stats`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      stats = await res.json();
    } else {
      error = "Could not load stats.";
    }
    loading = false;
  });
</script>

<svelte:head
  ><title>Dashboard — {activeStore.name || "Store"}</title></svelte:head
>

<div class="p-6">
  <div class="mb-6">
    <h1 class="text-xl font-semibold text-gray-900">
      {activeStore.name || activeStore.slug}
    </h1>
    <p class="text-sm text-gray-500 mt-0.5 font-mono">{activeStore.slug}</p>
  </div>

  {#if loading}
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
      {#each Array(6) as _}
        <div
          class="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24"
        ></div>
      {/each}
    </div>
  {:else if error}
    <div
      class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
    >
      {error}
    </div>
  {:else if stats}
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
      {#each statCards as card}
        <a
          href={card.href}
          class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm text-gray-500">{card.label}</span>
            <div class="p-2 rounded-lg {card.color}">
              <card.icon class="w-4 h-4" />
            </div>
          </div>
          <div class="text-2xl font-semibold text-gray-900">
            {stats[card.key as keyof Stats] ?? 0}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
