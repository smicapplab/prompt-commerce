<script lang="ts">
	import type { AttributeFieldsProps } from "$lib/types/components.js";
	import Input from "$lib/components/ui/Input.svelte";

	let { id, type, attributes = {}, onChange }: AttributeFieldsProps = $props();

	function update(field: string, value: string | number | boolean) {
		onChange({ ...attributes, [field]: value });
	}
</script>

<div class="flex flex-wrap gap-3">
	{#if type === "wearable"}
		<div class="flex-1 min-w-[120px]">
			<Input
				{id}
				placeholder="Color (e.g. Red)"
				value={attributes.color || ""}
				oninput={(e) => update("color", e.currentTarget.value)}
			/>
		</div>
		<div class="flex-1 min-w-[100px]">
			<Input
				placeholder="Size (e.g. XL)"
				value={attributes.size || ""}
				oninput={(e) => update("size", e.currentTarget.value)}
			/>
		</div>
	{:else if type === "food"}
		<div class="flex-1 min-w-[120px]">
			<Input
				{id}
				placeholder="Size/Weight (e.g. 500g)"
				value={attributes.size || ""}
				oninput={(e) => update("size", e.currentTarget.value)}
			/>
		</div>
		<div class="flex-1 min-w-[100px]">
			<Input
				placeholder="Flavor (optional)"
				value={attributes.flavor || ""}
				oninput={(e) => update("flavor", e.currentTarget.value)}
			/>
		</div>
	{:else if type === "device"}
		<div class="flex-1 min-w-[120px]">
			<Input
				{id}
				placeholder="Storage (e.g. 256GB)"
				value={attributes.storage || ""}
				oninput={(e) => update("storage", e.currentTarget.value)}
			/>
		</div>
		<div class="flex-1 min-w-[100px]">
			<Input
				placeholder="Color"
				value={attributes.color || ""}
				oninput={(e) => update("color", e.currentTarget.value)}
			/>
		</div>
	{:else if type === "travel"}
		<div class="flex-1 min-w-[150px]">
			<Input
				{id}
				placeholder="Class/Tier (e.g. Economy)"
				value={attributes.tier || ""}
				oninput={(e) => update("tier", e.currentTarget.value)}
			/>
		</div>
	{:else}
		<div class="flex-1 min-w-[200px]">
			<Input
				{id}
				placeholder="Custom attributes (JSON or comma list)..."
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
