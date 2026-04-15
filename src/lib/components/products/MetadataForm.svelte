<script lang="ts">
	import type { MetadataFormProps } from '$lib/types/components.js';

	let { type, metadata = {}, onChange }: MetadataFormProps = $props();

	function update(field: string, value: string | number | boolean | string[]) {
		onChange({ ...metadata, [field]: value });
	}

	// Simple tag input helper
	function handleTags(field: string, val: string) {
		const tags = val.split(',').map(t => t.trim()).filter(Boolean);
		update(field, tags);
	}
</script>

<div class="space-y-6">
	{#if type === 'generic'}
		<div class="p-8 border-2 border-dashed border-slate-100 rounded-xl text-center text-slate-400">
			Generic products use basic info only. No additional metadata required.
		</div>
	{:else if type === 'wearable'}
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="material">Material</label>
				<input
					id="material"
					type="text"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					placeholder="Cotton, Polyester..."
					value={metadata.material || ''}
					oninput={(e) => update('material', e.currentTarget.value)}
				/>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="fit">Fit</label>
				<select
					id="fit"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
					value={metadata.fit || ''}
					onchange={(e) => update('fit', e.currentTarget.value)}
				>
					<option value="">Select fit...</option>
					<option value="Regular">Regular</option>
					<option value="Slim">Slim</option>
					<option value="Oversized">Oversized</option>
					<option value="Relaxed">Relaxed</option>
				</select>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="gender">Gender</label>
				<select
					id="gender"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
					value={metadata.gender || ''}
					onchange={(e) => update('gender', e.currentTarget.value)}
				>
					<option value="">Unisex</option>
					<option value="Men">Men</option>
					<option value="Women">Women</option>
					<option value="Kids">Kids</option>
				</select>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="care">Care Instructions</label>
				<input
					id="care"
					type="text"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					placeholder="Machine wash cold..."
					value={metadata.care_instructions || ''}
					oninput={(e) => update('care_instructions', e.currentTarget.value)}
				/>
			</div>
		</div>
	{:else if type === 'food'}
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="perishable">Perishable</label>
				<div class="flex items-center space-x-2 h-10">
					<input
						id="perishable"
						type="checkbox"
						class="w-5 h-5 accent-blue-600"
						checked={!!metadata.perishable}
						onchange={(e) => update('perishable', e.currentTarget.checked)}
					/>
					<span class="text-sm text-slate-600">Needs refrigeration/fast delivery</span>
				</div>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="form">Form</label>
				<select
					id="form"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
					value={metadata.form || ''}
					onchange={(e) => update('form', e.currentTarget.value)}
				>
					<option value="fresh">Fresh</option>
					<option value="canned">Canned</option>
					<option value="frozen">Frozen</option>
					<option value="dried">Dried</option>
					<option value="cooked">Cooked</option>
				</select>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="allergens">Allergens</label>
				<input
					id="allergens"
					type="text"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					placeholder="Nuts, Dairy, Soy (comma separated)"
					value={(metadata.allergens as string[] | undefined)?.join(', ') || ''}
					oninput={(e) => handleTags('allergens', e.currentTarget.value)}
				/>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="shelf">Shelf Life (Days)</label>
				<input
					id="shelf"
					type="number"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					value={metadata.shelf_life_days || ''}
					oninput={(e) => update('shelf_life_days', parseInt(e.currentTarget.value))}
				/>
			</div>
		</div>
	{:else if type === 'device'}
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="brand">Brand</label>
				<input
					id="brand"
					type="text"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					value={metadata.brand || ''}
					oninput={(e) => update('brand', e.currentTarget.value)}
				/>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="model">Model</label>
				<input
					id="model"
					type="text"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					value={metadata.model || ''}
					oninput={(e) => update('model', e.currentTarget.value)}
				/>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="warranty">Warranty (Months)</label>
				<input
					id="warranty"
					type="number"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					value={metadata.warranty_months || ''}
					oninput={(e) => update('warranty_months', parseInt(e.currentTarget.value))}
				/>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="condition">Condition</label>
				<select
					id="condition"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
					value={metadata.condition || 'new'}
					onchange={(e) => update('condition', e.currentTarget.value)}
				>
					<option value="new">Brand New</option>
					<option value="open-box">Open Box</option>
					<option value="refurbished">Refurbished</option>
					<option value="used">Used</option>
				</select>
			</div>
		</div>
	{:else if type === 'travel'}
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="origin">Origin</label>
				<input
					id="origin"
					type="text"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					value={metadata.origin || ''}
					oninput={(e) => update('origin', e.currentTarget.value)}
				/>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="destination">Destination</label>
				<input
					id="destination"
					type="text"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					value={metadata.destination || ''}
					oninput={(e) => update('destination', e.currentTarget.value)}
				/>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="carrier">Carrier/Operator</label>
				<input
					id="carrier"
					type="text"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					value={metadata.carrier || ''}
					oninput={(e) => update('carrier', e.currentTarget.value)}
				/>
			</div>
			<div class="space-y-1.5">
				<label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="duration">Duration (Hours)</label>
				<input
					id="duration"
					type="number"
					step="0.5"
					class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					value={metadata.duration_hours || ''}
					oninput={(e) => update('duration_hours', parseFloat(e.currentTarget.value))}
				/>
			</div>
		</div>
	{/if}
</div>
