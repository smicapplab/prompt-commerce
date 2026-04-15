<script lang="ts">
	import { untrack } from "svelte";
	import AttributeFields from "./AttributeFields.svelte";
	import { Save, X, Check, AlertCircle, Image as ImageIcon } from "@lucide/svelte";
	import Button from "$lib/components/ui/Button.svelte";
	import Input from "$lib/components/ui/Input.svelte";

	import type { VariantRowFormProps } from "$lib/types/components.js";

	let {
		store,
		productId,
		productTitle,
		productSku,
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
			images: variant?.images || [],
			is_always_available: variant?.is_always_available ?? false,
		}) as const;

	const initialValues = untrack(() => snapshot());

	let sku = $state(initialValues.sku);
	let price = $state(initialValues.price);
	let stock = $state(initialValues.stock);
	let active = $state(initialValues.active);
	let attributes = $state(initialValues.attributes);
	let images_urls = $state(initialValues.images);
	let is_always_available = $state(initialValues.is_always_available);

	let newImageFiles = $state<File[]>([]);
	let imagePreviewUrls = $state<string[]>([]);

	// Auto-SKU logic
	$effect(() => {
		if (!variant && Object.values(attributes).some((v) => !!v)) {
			const basePart = (productSku || productTitle).replace(/[^a-zA-Z0-9]/g, "");
			const attrParts = Object.values(attributes)
				.filter(Boolean)
				.map((v) => String(v).replace(/[^a-zA-Z0-9]/g, ""));
			sku = [basePart, ...attrParts].join("-").toUpperCase();
		}
	});

	async function save() {
		loading = true;
		error = "";

		const data = new FormData();
		data.append("product_id", String(productId));
		data.append("sku", sku);
		data.append("price", String(price));
		data.append("stock", String(stock));
		data.append("active", active ? "1" : "0");
		data.append("is_always_available", is_always_available ? "1" : "0");
		data.append("attributes", JSON.stringify(attributes));
		data.append("images_urls", (images_urls || []).join(","));
		newImageFiles.forEach((file) => data.append("images[]", file));

		try {
			const url = variant
				? `/api/variants/${variant.id}?store=${store}`
				: `/api/variants?store=${store}`;

			const token = localStorage.getItem("pc_token");
			const res = await fetch(url, {
				method: variant ? "PATCH" : "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: data,
			});

			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || "Failed to save variant");
			}

			const saved = await res.json();
			onSave(saved);
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	function handleImageSelect(e: any) {
		const files = Array.from(e.target.files || []) as File[];
		newImageFiles = [...newImageFiles, ...files];
		files.forEach((file) => {
			const reader = new FileReader();
			reader.onload = (ev) => {
				if (typeof ev.target?.result === "string") {
					imagePreviewUrls = [...imagePreviewUrls, ev.target.result];
				}
			};
			reader.readAsDataURL(file);
		});
	}

	function removeImage(idx: number, isNew: boolean) {
		if (isNew) {
			newImageFiles = newImageFiles.filter((_, i) => i !== idx);
			imagePreviewUrls = imagePreviewUrls.filter((_, i) => i !== idx);
		} else {
			images_urls = (images_urls || []).filter((_, i) => i !== idx);
		}
	}
</script>

<div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div class="space-y-4">
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

			<div class="space-y-2">
				<span class="text-[13px] font-bold text-gray-700 tracking-tight"
					>Variant Media</span
				>
				<div class="grid grid-cols-4 gap-2">
					{#each images_urls || [] as url, i (url)}
						<div
							class="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm"
						>
							<img src={url} alt="Variant" class="w-full h-full object-cover" />
							<Button
								variant="danger"
								size="icon"
								onclick={() => removeImage(i, false)}
								class="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<X size={10} />
							</Button>
						</div>
					{/each}
					{#each imagePreviewUrls as url, i (url)}
						<div
							class="relative group aspect-square rounded-lg overflow-hidden border-2 border-indigo-500"
						>
							<img
								src={url}
								alt="New Variant"
								class="w-full h-full object-cover"
							/>
							<Button
								variant="danger"
								size="icon"
								onclick={() => removeImage(i, true)}
								class="absolute top-0.5 right-0.5 h-5 w-5"
							>
								<X size={10} />
							</Button>
						</div>
					{/each}
					<label
						class="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white hover:bg-slate-100 hover:border-indigo-300 cursor-pointer transition-all group"
					>
						<ImageIcon
							size={20}
							class="text-slate-400 mb-0.5 group-hover:text-indigo-500 transition-colors"
						/>
						<span class="text-[8px] font-bold text-slate-500 uppercase"
							>Upload</span
						>
						<input
							type="file"
							multiple
							accept="image/*"
							class="hidden"
							onchange={handleImageSelect}
						/>
					</label>
				</div>
			</div>
		</div>

		<div class="space-y-4">
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
					disabled={is_always_available}
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

			<div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
				<div class="flex flex-col">
					<span class="text-xs font-bold text-slate-700">Always Available</span>
					<p class="text-[10px] text-slate-400 leading-tight">Skip stock check for this variant</p>
				</div>
				<button 
					onclick={() => is_always_available = !is_always_available}
					aria-label={is_always_available ? 'Disable always available' : 'Enable always available'}
					class="w-10 h-5 rounded-full p-1 transition-colors {is_always_available ? 'bg-indigo-600' : 'bg-slate-300'}"
				>
					<div class="bg-white w-3 h-3 rounded-full transition-transform {is_always_available ? 'translate-x-5' : 'translate-x-0'} shadow-sm"></div>
				</button>
			</div>

			<div class="flex-1">
				<Input
					id="variant-sku"
					label="SKU (Auto-generated or Manual)"
					placeholder="SKU"
					class="font-mono tracking-tight"
					bind:value={sku}
				/>
			</div>
		</div>
	</div>

	<div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/50">
		<Button
			variant="secondary"
			size="sm"
			class="px-4 border-none bg-slate-200/50 hover:bg-slate-200 text-slate-600 font-bold uppercase text-[10px]"
			onclick={onCancel}
			disabled={loading}
		>
			Cancel
		</Button>
		<Button
			variant="primary"
			size="sm"
			class="px-6 h-9 min-w-32"
			onclick={save}
			disabled={loading}
		>
			{#if loading}
				<div
					class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"
				></div>
			{:else}
				<Save size={14} class="mr-2" />
			{/if}
			<span class="font-bold uppercase text-[10px]">
				{variant ? "Update Variant" : "Add Variant"}
			</span>
		</Button>
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
