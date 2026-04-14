<script lang="ts">
	import { untrack } from 'svelte';
	import AttributeFields from './AttributeFields.svelte';
	import { Save, X, Trash2, Check, AlertCircle } from '@lucide/svelte';

	import type { ProductVariant } from '$lib/types/catalog.js';

	interface Props {
		store: string;
		productId: number;
		productTitle: string;
		productType: string;
		variant?: ProductVariant | null; // If null, we're adding
		onSave: (v: ProductVariant) => void;
		onCancel: () => void;
	}

	let { store, productId, productTitle, productType, variant, onSave, onCancel }: Props = $props();

	let loading = $state(false);
	let error = $state('');

	// Use a helper function and untrack() to capture initial values and avoid
	// reactivity warnings. Forms represent a snapshot.
	const snapshot = () => ({
		sku: variant?.sku || '',
		price: variant?.price ?? 0,
		stock: variant?.stock ?? 0,
		active: variant?.active ?? true,
		attributes: { ...(variant?.attributes || {}) }
	} as const);

	const initialValues = untrack(() => snapshot());

	let sku = $state(initialValues.sku);
	let price = $state(initialValues.price);
	let stock = $state(initialValues.stock);
	let active = $state(initialValues.active);
	let attributes = $state(initialValues.attributes);

	// Auto-SKU logic
	$effect(() => {
		if (!variant && (Object.values(attributes).some(v => !!v))) {
			const titlePart = productTitle.replace(/[^a-zA-Z0-9]/g, '');
			const attrParts = Object.values(attributes)
				.filter(Boolean)
				.map(v => String(v).replace(/[^a-zA-Z0-9]/g, ''));
			sku = [titlePart, ...attrParts].join('-').toUpperCase();
		}
	});

	async function save() {
		loading = true;
		error = '';
		try {
			const url = variant 
				? `/api/variants/${variant.id}?store=${store}`
				: `/api/variants?store=${store}`;
			
			const token = localStorage.getItem('pc_token');
			const res = await fetch(url, {
				method: variant ? 'PATCH' : 'POST',
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					product_id: productId,
					sku,
					price,
					stock,
					active,
					attributes
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to save variant');
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
			<label for="variant-attributes" class="text-[10px] font-bold uppercase text-slate-400">Attributes</label>
			<AttributeFields id="variant-attributes" type={productType} {attributes} onChange={(a) => attributes = a} />
		</div>
		
		<div class="grid grid-cols-3 gap-2">
			<div class="space-y-1.5">
				<label for="variant-price" class="text-[10px] font-bold uppercase text-slate-400">Price (₱)</label>
				<input
					id="variant-price"
					type="number"
					class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-blue-500"
					bind:value={price}
				/>
			</div>
			<div class="space-y-1.5">
				<label for="variant-stock" class="text-[10px] font-bold uppercase text-slate-400">Stock</label>
				<input
					id="variant-stock"
					type="number"
					class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-blue-500"
					bind:value={stock}
				/>
			</div>
			<div class="space-y-1.5">
				<span class="text-[10px] font-bold uppercase text-slate-400">Status</span>
				<button 
					type="button"
					onclick={() => active = !active}
					aria-label={active ? 'Deactivate variant' : 'Activate variant'}
					class="w-full h-[30px] flex items-center justify-center rounded border transition-colors
						{active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-100 text-slate-400 border-slate-200'}"
				>
					<Check size={14} class={active ? 'block' : 'hidden'} />
					<span class="text-[10px] font-bold ml-1">{active ? 'ACTIVE' : 'INACTIVE'}</span>
				</button>
			</div>
		</div>
	</div>

	<div class="flex items-center space-x-3">
		<div class="flex-1 space-y-1.5">
			<label for="variant-sku" class="text-[10px] font-bold uppercase text-slate-400">SKU (Auto-generated or Manual)</label>
			<input
				id="variant-sku"
				type="text"
				placeholder="SKU"
				class="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono tracking-tight"
				bind:value={sku}
			/>
		</div>

		<div class="flex items-end space-x-2 pb-0.5">
			<button
				type="button"
				class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
				onclick={onCancel}
				disabled={loading}
				aria-label="Cancel editing"
			>
				<X size={20} />
			</button>
			<button
				type="button"
				class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm flex items-center shadow-sm transition-all disabled:opacity-50"
				onclick={save}
				disabled={loading}
				aria-label={variant ? 'Update variant' : 'Add variant'}
			>
				{#if loading}
					<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
				{:else}
					<Save size={16} class="mr-2" />
				{/if}
				{variant ? 'Update' : 'Add Variant'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="flex items-center text-red-600 text-xs bg-red-50 p-2 rounded border border-red-100 italic">
			<AlertCircle size={14} class="mr-1.5" />
			{error}
		</div>
	{/if}
</div>
