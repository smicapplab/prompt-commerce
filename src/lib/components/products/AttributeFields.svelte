<script lang="ts">
	import type { AttributeFieldsProps } from "$lib/types/components.js";
	import Input from "$lib/components/ui/Input.svelte";

	let { id, type, attributes = {}, onChange }: AttributeFieldsProps = $props();

	function update(field: string, value: string | number | boolean) {
		onChange({ ...attributes, [field]: value });
	}

	function handleInput(field: string) {
		return (e: Event) => {
			update(field, (e.currentTarget as HTMLInputElement).value);
		};
	}

	function formatValue(val: string | number | boolean | undefined): string | number {
		if (typeof val === "boolean") return val ? "true" : "false";
		return val ?? "";
	}
</script>

<div class="flex flex-wrap gap-3">
	{#if type === "wearable"}
		<div class="flex-1 min-w-30">
			<Input
				{id}
				placeholder="Color (e.g. Red)"
				value={formatValue(attributes.color)}
				oninput={handleInput("color")}
			/>
		</div>
		<div class="flex-1 min-w-25">
			<Input
				placeholder="Size (e.g. XL)"
				value={formatValue(attributes.size)}
				oninput={handleInput("size")}
			/>
		</div>
	{:else if type === "food"}
		<div class="flex-1 min-w-30">
			<Input
				{id}
				placeholder="Size/Weight (e.g. 500g)"
				value={formatValue(attributes.size)}
				oninput={handleInput("size")}
			/>
		</div>
		<div class="flex-1 min-w-25">
			<Input
				placeholder="Flavor (optional)"
				value={formatValue(attributes.flavor)}
				oninput={handleInput("flavor")}
			/>
		</div>
	{:else if type === "device"}
		<div class="flex-1 min-w-30">
			<Input
				{id}
				placeholder="Storage (e.g. 256GB)"
				value={formatValue(attributes.storage)}
				oninput={handleInput("storage")}
			/>
		</div>
		<div class="flex-1 min-w-25">
			<Input
				placeholder="Color"
				value={formatValue(attributes.color)}
				oninput={handleInput("color")}
			/>
		</div>
	{:else if type === "travel"}
		<div class="flex-1 min-w-37.5">
			<Input
				{id}
				placeholder="Class/Tier (e.g. Economy)"
				value={formatValue(attributes.tier)}
				oninput={handleInput("tier")}
			/>
		</div>
	{:else}
		<div class="flex-1 min-w-50">
			<Input
				{id}
				placeholder="Custom attributes (JSON or comma list)..."
				value={JSON.stringify(attributes)}
				oninput={(e: Event) => {
					try {
						onChange(JSON.parse((e.currentTarget as HTMLInputElement).value));
					} catch {
						// Silently fail until valid JSON
					}
				}}
			/>
		</div>
	{/if}
</div>
