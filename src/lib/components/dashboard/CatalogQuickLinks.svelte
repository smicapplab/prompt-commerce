<script lang="ts">
  import { Package, Tag, Gift, Star, MessageSquare } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import Card from "$lib/components/ui/Card.svelte";
  import type { Stats } from "$lib/types/dashboard.js";

  interface Props {
    stats: Stats;
  }

  let { stats }: Props = $props();

  const countCards = [
    {
      label: "Products",
      key: "products",
      icon: Package,
      href: "/admin/products",
      color: "bg-blue-50   text-blue-600",
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
      label: "Conversations",
      key: "conversations",
      icon: MessageSquare,
      href: "/admin/chat",
      color: "bg-pink-50   text-pink-600",
    },
  ];
</script>

<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
  {#each countCards as card}
    <Card
      onclick={() => goto(card.href)}
      class="p-4 hover:shadow-md transition-shadow flex items-center gap-3 group cursor-pointer"
    >
      <div class="p-2 rounded-lg {card.color} shrink-0">
        <card.icon class="w-4 h-4" />
      </div>
      <div>
        <p
          class="text-[10px] font-bold text-gray-400 uppercase tracking-wider"
        >
          {card.label}
        </p>
        <p class="text-lg font-black text-gray-900 leading-none mt-0.5">
          {stats[card.key as keyof Stats] ?? 0}
        </p>
      </div>
    </Card>
  {/each}
</div>
