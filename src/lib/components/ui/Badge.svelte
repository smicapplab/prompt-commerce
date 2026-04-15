<script lang="ts">
	import type { BadgeProps } from '$lib/types/ui.js';

	let { class: className = '', variant = 'secondary', children }: BadgeProps = $props();

  const variantStyle: Record<string, string> = {
    primary: "bg-indigo-50 text-indigo-700 border-indigo-100",
    secondary: "bg-gray-50 text-gray-700 border-gray-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    danger: "bg-red-50 text-red-700 border-red-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
  };
</script>

<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border {variantStyle[variant]} {className}">
  {#if children}
    {@render children()}
  {/if}
</span>
