<script lang="ts">
	import type { CardProps } from '$lib/types/ui.js';

	let { class: className = '', children, ...rest }: CardProps = $props();
</script>

<div class="bg-white rounded-2xl border border-gray-100 shadow-sm {className}" {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
