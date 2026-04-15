<script lang="ts">
	import { Box, Shirt, Utensils, Smartphone, Plane } from '@lucide/svelte';
	import type { ProductTypeSelectorProps } from '$lib/types/components.js';
	import Button from '$lib/components/ui/Button.svelte';

	let { value, onSelect }: ProductTypeSelectorProps = $props();

	const types = [
		{ id: 'generic', label: 'Generic', icon: Box, description: 'Standard product' },
		{ id: 'wearable', label: 'Wearable', icon: Shirt, description: 'Clothing, shoes' },
		{ id: 'food', label: 'Food', icon: Utensils, description: 'Groceries, meals' },
		{ id: 'device', label: 'Device', icon: Smartphone, description: 'Electronics' },
		{ id: 'travel', label: 'Travel', icon: Plane, description: 'Tickets, tours' }
	];
</script>

<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
	{#each types as t}
		<Button
			variant={value === t.id ? 'primary' : 'outline'}
			onclick={() => onSelect(t.id)}
			class="flex flex-col items-center justify-center p-4 h-auto text-center space-y-2 {value === t.id ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : ''}"
		>
			<t.icon size={32} strokeWidth={1.5} class="mb-1" />
			<div>
				<p class="font-bold text-sm leading-tight">{t.label}</p>
				<p class="text-[10px] opacity-70 mt-1 leading-tight">{t.description}</p>
			</div>
		</Button>
	{/each}
</div>
