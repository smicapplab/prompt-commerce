<script lang="ts">
	import type { AttributeFieldsProps } from '$lib/types/components.js';

	let { id, type, attributes = {}, onChange }: AttributeFieldsProps = $props();

	function update(field: string, value: string | number | boolean) {
		onChange({ ...attributes, [field]: value });
	}
</script>

<div class="flex flex-wrap gap-3">
	{#if type === 'wearable'}
		<div class="flex-1 min-w-[120px]">
			<input
				{id}
				type="text"
				placeholder="Color (e.g. Red)"
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
				value={attributes.color || ''}
				oninput={(e) => update('color', e.currentTarget.value)}
			/>
		</div>
		<div class="flex-1 min-w-[100px]">
			<input
				type="text"
				placeholder="Size (e.g. XL)"
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
				value={attributes.size || ''}
				oninput={(e) => update('size', e.currentTarget.value)}
			/>
		</div>
	{:else if type === 'food'}
		<div class="flex-1 min-w-[120px]">
			<input
				{id}
				type="text"
				placeholder="Size/Weight (e.g. 500g)"
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
				value={attributes.size || ''}
				oninput={(e) => update('size', e.currentTarget.value)}
			/>
		</div>
		<div class="flex-1 min-w-[100px]">
			<input
				type="text"
				placeholder="Flavor (optional)"
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
				value={attributes.flavor || ''}
				oninput={(e) => update('flavor', e.currentTarget.value)}
			/>
		</div>
	{:else if type === 'device'}
		<div class="flex-1 min-w-[120px]">
			<input
				{id}
				type="text"
				placeholder="Storage (e.g. 256GB)"
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
				value={attributes.storage || ''}
				oninput={(e) => update('storage', e.currentTarget.value)}
			/>
		</div>
		<div class="flex-1 min-w-[100px]">
			<input
				type="text"
				placeholder="Color"
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
				value={attributes.color || ''}
				oninput={(e) => update('color', e.currentTarget.value)}
			/>
		</div>
	{:else if type === 'travel'}
		<div class="flex-1 min-w-[150px]">
			<input
				{id}
				type="text"
				placeholder="Class/Tier (e.g. Economy)"
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
				value={attributes.tier || ''}
				oninput={(e) => update('tier', e.currentTarget.value)}
			/>
		</div>
	{:else}
		<div class="flex-1 min-w-[200px]">
			<input
				{id}
				type="text"
				placeholder="Custom attributes (JSON or comma list)..."
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
				value={JSON.stringify(attributes)}
				oninput={(e) => {
					try {
						onChange(JSON.parse(e.currentTarget.value));
					} catch {
                        // Silently fail until valid JSON
                    }
				}}
			/>
		</div>
	{/if}
</div>
