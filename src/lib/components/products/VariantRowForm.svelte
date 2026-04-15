<script lang="ts">
	import { untrack } from "svelte";
	import AttributeFields from "./AttributeFields.svelte";
	import { Save, X, Check, AlertCircle } from "@lucide/svelte";
	import Button from "$lib/components/ui/Button.svelte";
	import Input from "$lib/components/ui/Input.svelte";

	import type { VariantRowFormProps } from "$lib/types/components.js";

	let {
		store,
		productId,
		productTitle,
		productType,
		variant,
		prefillPrice,
		prefillStock,
		onSave,
		onCancel,
	}: VariantRowFormProps = $props();

	let loading = $state(false);
	let error = $state("");

	// Use a helper function and untrack() to capture initial values and avoid
	// reactivity warnings. Forms represent a snapshot.
	const snapshot = () =>
		({
			sku: variant?.sku || "",
			price: variant?.price ?? prefillPrice ?? 0,
			stock: variant?.stock ?? prefillStock ?? 0,
			active: variant?.active ?? true,
			attributes: { ...(variant?.attributes || {}) },
		}) as const;

	const initialValues = untrack(() => snapshot());

	let sku = $state(initialValues.sku);
	let price = $state(initialValues.price);
	let stock = $state(initialValues.stock);
	let active = $state(initialValues.active);
	let attributes = $state(initialValues.attributes);

	// Auto-SKU logic
	$effect(() => {
		if (!variant && Object.values(attributes).some((v) => !!v)) {
			const titlePart = productTitle.replace(/[^a-zA-Z0-9]/g, "");
			const attrParts = Object.values(attributes)
				.filter(Boolean)
				.map((v) => String(v).replace(/[^a-zA-Z0-9]/g, ""));
			sku = [titlePart, ...attrParts].join("-").toUpperCase();
		}
	});

	async function save() {
		loading = true;
		error = "";
		try {
			const url = variant
				? `/api/variants/${variant.id}?store=${store}`
				: `/api/variants?store=${store}`;

			const token = localStorage.getItem("pc_token");
			const res = await fetch(url, {
				method: variant ? "PATCH" : "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					product_id: productId,
					sku,
					price,
					stock,
					active,
					attributes,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to save variant");
			}

			const saved = await res.json();
			onSave(saved);
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div class="space-y-1.5">
			<label
				for="variant-attributes"
				class="text-[13px] font-bold text-gray-700 tracking-tight"
				>Attributes</label
			>
			<AttributeFields
				id="variant-attributes"
				type={productType}
				{attributes}
				onChange={(a) => (attributes = a)}
			/>
		</div>

		<div class="grid grid-cols-3 gap-3">
			<Input
				id="variant-price"
				type="number"
				label="Price (₱)"
				bind:value={price}
			/>
			<Input
				id="variant-stock"
				type="number"
				label="Stock"
				bind:value={stock}
			/>
			<div class="flex flex-col gap-1.5">
				<span class="text-[13px] font-bold text-gray-700 tracking-tight"
					>Status</span
				>
				<Button
					variant="secondary"
					class="h-10.5 w-full {active
						? 'bg-green-50 text-green-700 border-green-100'
						: 'bg-white text-slate-400 border-slate-200'}"
					onclick={() => (active = !active)}
				>
					<Check size={14} class={active ? "block" : "hidden"} />
					<span class="text-[10px] font-bold ml-1 uppercase"
						>{active ? "Active" : "Inactive"}</span
					>
				</Button>
			</div>
		</div>
	</div>

	<div class="flex items-end gap-3">
		<div class="flex-1">
			<Input
				id="variant-sku"
				label="SKU (Auto-generated or Manual)"
				placeholder="SKU"
				class="font-mono tracking-tight"
				bind:value={sku}
			/>
		</div>

		<div class="flex items-center gap-2 mb-0.5">
			<Button
				variant="secondary"
				size="icon"
				class="w-10 h-10 border-none bg-slate-200/50 hover:bg-slate-200 text-slate-500"
				onclick={onCancel}
				disabled={loading}
			>
				<X size={20} />
			</Button>
			<Button
				variant="primary"
				class="px-6 h-10 min-w-35"
				onclick={save}
				disabled={loading}
			>
				{#if loading}
					<div
						class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"
					></div>
				{:else}
					<Save size={16} class="mr-2" />
				{/if}
				{variant ? "Update" : "Add Variant"}
			</Button>
		</div>
	</div>

	{#if error}
		<div
			class="flex items-center text-red-600 text-xs bg-red-50 p-2 rounded border border-red-100 italic"
		>
			<AlertCircle size={14} class="mr-1.5" />
			{error}
		</div>
	{/if}
</div>
