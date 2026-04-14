<script lang="ts">
	import { Box, Shirt, Utensils, Smartphone, Plane } from '@lucide/svelte';

	interface Props {
		value: string;
		onSelect: (type: string) => void;
	}

	let { value, onSelect }: Props = $props();

	const types = [
		{ id: 'generic', label: 'Generic', icon: Box, description: 'Standard product' },
		{ id: 'wearable', label: 'Wearable', icon: Shirt, description: 'Clothing, shoes' },
		{ id: 'food', label: 'Food', icon: Utensils, description: 'Groceries, meals' },
		{ id: 'device', label: 'Device', icon: Smartphone, description: 'Electronics' },
		{ id: 'travel', label: 'Travel', icon: Plane, description: 'Tickets, tours' }
	];
</script>

<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
	{#each types as type}
		<button
			type="button"
			class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all text-center
				{value === type.id 
					? 'border-blue-500 bg-blue-50 text-blue-700' 
					: 'border-slate-100 bg-white hover:border-slate-200 text-slate-500 hover:text-slate-700'}"
			onclick={() => onSelect(type.id)}
		>
			<type.icon size={32} strokeWidth={1.5} class="mb-2" />
			<span class="font-semibold text-sm">{type.label}</span>
			<span class="text-[10px] opacity-70 mt-1">{type.description}</span>
		</button>
	{/each}
</div>
