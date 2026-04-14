<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Edit2, Trash2, AlertCircle, Layers } from '@lucide/svelte';
	import VariantRowForm from './VariantRowForm.svelte';

	interface Props {
		store: string;
		productId: number;
		productTitle: string;
		productType: string;
	}

	let { store, productId, productTitle, productType }: Props = $props();

	let variants = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let showAdd = $state(false);
	let editingId = $state<number | null>(null);

	onMount(fetchVariants);

	async function fetchVariants() {
		loading = true;
		try {
			const token = localStorage.getItem('pc_token');
			const res = await fetch(`/api/variants?store=${store}&product_id=${productId}`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});
			const data = await res.json();
			variants = data.variants || [];
		} catch (e: any) {
			error = 'Failed to load variants';
		} finally {
			loading = false;
		}
	}

	function handleSave(v: any) {
		const idx = variants.findIndex(item => item.id === v.id);
		if (idx > -1) {
			variants[idx] = v;
		} else {
			variants = [...variants, v];
		}
		editingId = null;
		showAdd = false;
	}

	async function toggleActive(v: any) {
		try {
			const token = localStorage.getItem('pc_token');
			const res = await fetch(`/api/variants/${v.id}?store=${store}`, {
				method: 'PATCH',
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ active: !v.active })
			});
			if (res.ok) {
				const updated = await res.json();
				const idx = variants.findIndex(item => item.id === v.id);
				variants[idx] = updated;
			}
		} catch (e) {
			console.error('Failed to toggle active status');
		}
	}

    async function deleteVariant(id: number) {
        if (!confirm('Are you sure you want to deactivate this variant?')) return;
        try {
            const token = localStorage.getItem('pc_token');
            const res = await fetch(`/api/variants/${id}?store=${store}`, { 
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                // Since our API does soft delete (active=0), we can just update local state or re-fetch
                const idx = variants.findIndex(item => item.id === id);
                variants[idx].active = false;
            }
        } catch (e) {
            console.error('Delete failed');
        }
    }

	function formatAttr(attr: any) {
		if (!attr) return '—';
		return Object.entries(attr)
			.filter(([_, v]) => !!v)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ') || '—';
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center text-slate-500">
			<Layers size={18} class="mr-2" />
			<h3 class="font-semibold text-sm uppercase tracking-wider">Product Variations</h3>
		</div>
		<button
			type="button"
			class="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold flex items-center transition-all shadow-sm"
			onclick={() => showAdd = true}
			disabled={showAdd}
		>
			<Plus size={14} class="mr-1.5" />
			Add Variation
		</button>
	</div>

	{#if loading && variants.length === 0}
		<div class="py-12 flex flex-col items-center justify-center text-slate-400">
			<div class="w-8 h-8 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin mb-3"></div>
			<p class="text-sm">Loading variations...</p>
		</div>
	{:else if error}
		<div class="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-600 text-sm">
			<AlertCircle size={18} class="mr-2" />
			{error}
		</div>
	{:else}
		<div class="border border-slate-100 rounded-xl overflow-hidden bg-white">
			<table class="w-full text-left text-sm border-collapse">
				<thead>
					<tr class="bg-slate-50/50 border-b border-slate-100">
						<th class="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase">SKU / Attributes</th>
						<th class="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase text-right">Price</th>
						<th class="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase text-center">Stock</th>
						<th class="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase text-right w-24">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50">
					{#if showAdd}
						<tr>
							<td colspan="4" class="p-2">
								<VariantRowForm 
									{store} 
									{productId} 
									{productTitle} 
									{productType} 
									onSave={handleSave} 
									onCancel={() => showAdd = false} 
								/>
							</td>
						</tr>
					{/if}

					{#each variants as v (v.id)}
						{#if editingId === v.id}
							<tr>
								<td colspan="4" class="p-2">
									<VariantRowForm 
										{store} 
										{productId} 
										{productTitle} 
										{productType} 
										variant={v}
										onSave={handleSave} 
										onCancel={() => editingId = null} 
									/>
								</td>
							</tr>
						{:else}
							<tr class="hover:bg-slate-50/50 transition-colors {!v.active ? 'opacity-50' : ''}">
								<td class="px-4 py-3">
									<div class="font-mono text-[11px] font-bold text-slate-700 {v.active ? '' : 'line-through decoration-slate-400'}">{v.sku}</div>
									<div class="text-xs text-slate-400 mt-0.5">{formatAttr(v.attributes)}</div>
								</td>
								<td class="px-4 py-3 text-right font-semibold text-slate-900">
									₱{v.price.toLocaleString()}
								</td>
								<td class="px-4 py-3 text-center">
									<span class="px-2 py-0.5 rounded-full text-[10px] font-bold 
										{v.stock <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}">
										{v.stock} in stock
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end space-x-1">
										<button 
											class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
											onclick={() => editingId = v.id}
										>
											<Edit2 size={14} />
										</button>
										<button 
											class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
											onclick={() => deleteVariant(v.id)}
										>
											<Trash2 size={14} />
										</button>
									</div>
								</td>
							</tr>
						{/if}
					{/each}

					{#if variants.length === 0 && !showAdd}
						<tr>
							<td colspan="4" class="py-12 text-center text-slate-400 italic text-sm">
								No variations added yet.
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>
