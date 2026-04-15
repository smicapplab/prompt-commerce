<script lang="ts">
	import { 
		X, Save, Image as ImageIcon, 
		Package, Settings2, Layers, Check, AlertCircle 
	} from '@lucide/svelte';
	import ProductTypeSelector from './ProductTypeSelector.svelte';
	import MetadataForm from './MetadataForm.svelte';
	import VariantsTable from './VariantsTable.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	import type { ProductModalProps } from '$lib/types/components.js';

	let { store, isEditing, productId, categories, onClose, onSave }: ProductModalProps = $props();

	let activeTab = $state<'basic' | 'metadata' | 'variants'>('basic');
	let saving = $state(false);
	let error = $state('');

	let formData = $state({
		title: '',
		sku: '',
		description: '',
		category_id: '' as string | number,
		price: '' as string | number,
		stock_quantity: '' as string | number,
		active: true,
		tags: '',
		product_type: 'generic' as const,
		metadata: {} as Record<string, unknown>,
		images_urls: [] as string[]
	});

	let newImageFiles = $state<File[]>([]);
	let imagePreviewUrls = $state<string[]>([]);
	let loading = $state(false);

	const getAuthHeaders = () => {
		const token = localStorage.getItem('pc_token');
		return { Authorization: `Bearer ${token}` };
	};

	$effect(() => {
		if (productId) loadProduct();
	});

	async function loadProduct() {
		loading = true;
		try {
			const res = await fetch(`/api/products/${productId}?store=${store}`, {
				headers: getAuthHeaders()
			});
			if (res.ok) {
				const product = await res.json();
				formData = {
					title: product.title || '',
					sku: product.sku || '',
					description: product.description || '',
					category_id: product.category_id || '',
					price: product.price || '',
					stock_quantity: product.stock_quantity || '',
					active: !!product.active,
					tags: (product.tags || []).join(', '),
					product_type: product.product_type || 'generic',
					metadata: product.metadata || {},
					images_urls: product.images || []
				};
			}
		} catch (e) {
			error = 'Failed to load product details';
		} finally {
			loading = false;
		}
	}

	async function save() {
		if (!formData.title.trim()) {
			error = 'Title is required';
			return;
		}

		saving = true;
		error = '';

		const data = new FormData();
		data.append('title', formData.title);
		data.append('sku', formData.sku);
		data.append('description', formData.description);
		data.append('category_id', String(formData.category_id));
		data.append('price', String(formData.price || 0));
		data.append('stock_quantity', String(formData.stock_quantity || 0));
		data.append('active', formData.active ? '1' : '0');
		data.append('tags', formData.tags);
		data.append('product_type', formData.product_type);
		data.append('metadata', JSON.stringify(formData.metadata));

		newImageFiles.forEach(file => data.append('images[]', file));
		data.append('images_urls', formData.images_urls.join(','));

		try {
			const url = isEditing
				? `/api/products/${productId}?store=${store}`
				: `/api/products?store=${store}`;
			const method = isEditing ? 'PATCH' : 'POST';

			const res = await fetch(url, {
				method,
				headers: getAuthHeaders(),
				body: data
			});

			if (res.ok) {
				onSave();
				onClose();
			} else {
				const d = await res.json();
				throw new Error(d.error || 'Failed to save product');
			}
		} catch (e: any) {
			error = e.message;
		} finally {
			saving = false;
		}
	}

	function handleImageSelect(e: any) {
		const files = Array.from(e.target.files || []) as File[];
		newImageFiles = [...newImageFiles, ...files];
		files.forEach(file => {
			const reader = new FileReader();
			reader.onload = (ev) => {
				if (typeof ev.target?.result === 'string') {
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
			formData.images_urls = formData.images_urls.filter((_, i) => i !== idx);
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
	<div class="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
		<!-- Header -->
		<div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
			<div>
				<h2 class="text-xl font-bold text-slate-900">
					{isEditing ? 'Edit Product' : 'Add New Product'}
				</h2>
				<p class="text-xs text-slate-500 mt-0.5">
					{productId ? `Product ID: ${productId}` : 'Fill in the details to create a new entry'}
				</p>
			</div>
			<Button variant="ghost" size="icon" onclick={onClose} class="rounded-full">
				<X size={20} />
			</Button>
		</div>

		<!-- Tabs -->
		<div class="flex border-b border-slate-100 px-6 space-x-8 bg-white sticky top-0 z-10">
			{#each [
				{ id: 'basic', label: 'Basic Info', icon: Package },
				{ id: 'metadata', label: 'Type & Metadata', icon: Settings2 },
				{ id: 'variants', label: 'Variants', icon: Layers, hide: formData.product_type === 'generic' }
			] as tab}
				{#if !tab.hide}
					<button
						class="py-4 border-b-2 font-bold text-sm flex items-center transition-all
							{activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}"
						onclick={() => activeTab = tab.id as any}
					>
						<tab.icon size={16} class="mr-2" />
						{tab.label}
					</button>
				{/if}
			{/each}
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6 space-y-8">
			{#if loading}
				<div class="py-20 flex flex-col items-center justify-center text-slate-400">
					<div class="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
					<p class="font-medium">Loading details...</p>
				</div>
			{:else}
				{#if activeTab === 'basic'}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div class="space-y-6">
							<Input
								id="title"
								label="Product Title"
								placeholder="e.g. Premium Cotton T-Shirt"
								bind:value={formData.title}
							/>

							<div class="space-y-1.5">
								<label class="text-[13px] font-bold text-gray-700 tracking-tight" for="description">Description</label>
								<textarea
									id="description"
									rows="4"
									class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none text-sm"
									placeholder="Tell buyers more about this product..."
									bind:value={formData.description}
								></textarea>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<Select
									id="category"
									label="Category"
									bind:value={formData.category_id}
									options={[
										{ value: '', label: 'No Category' },
										...categories.map(cat => ({ value: cat.id, label: cat.name }))
									]}
								/>
								<Input
									id="sku"
									label="Base SKU"
									class="font-mono"
									placeholder="TSHIRT-001"
									bind:value={formData.sku}
								/>
							</div>
						</div>

						<div class="space-y-6">
							<div class="space-y-2">
								<span class="text-[13px] font-bold text-gray-700 tracking-tight">Media</span>
								<div class="grid grid-cols-3 gap-3">
									{#each formData.images_urls as url, i}
										<div class="relative group aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm">
											<img src={url} alt="Product" class="w-full h-full object-cover" />
											<Button 
												variant="danger"
												size="icon"
												onclick={() => removeImage(i, false)}
												class="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
											>
												<X size={12} />
											</Button>
										</div>
									{/each}
									{#each imagePreviewUrls as url, i}
										<div class="relative group aspect-square rounded-xl overflow-hidden border-2 border-indigo-500">
											<img src={url} alt="New Product" class="w-full h-full object-cover" />
											<Button 
												variant="danger"
												size="icon"
												onclick={() => removeImage(i, true)}
												class="absolute top-1 right-1 h-6 w-6"
											>
												<X size={12} />
											</Button>
										</div>
									{/each}
									<label class="aspect-square flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-300 cursor-pointer transition-all group">
										<ImageIcon size={24} class="text-slate-400 mb-1 group-hover:text-indigo-500 transition-colors" />
										<span class="text-[10px] font-bold text-slate-500 uppercase">Upload</span>
										<input type="file" multiple accept="image/*" class="hidden" onchange={handleImageSelect} />
									</label>
								</div>
							</div>

							{#if formData.product_type === 'generic'}
								<div class="grid grid-cols-2 gap-4">
									<Input
										id="price"
										type="number"
										label="Price (₱)"
										step="0.01"
										bind:value={formData.price}
									/>
									<Input
										id="stock"
										type="number"
										label="Stock"
										bind:value={formData.stock_quantity}
									/>
								</div>
							{:else}
								<div class="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start">
									<AlertCircle size={18} class="text-indigo-600 mr-3 mt-0.5 shrink-0" />
									<p class="text-xs text-indigo-700 leading-relaxed font-medium">
										This is a <span class="uppercase font-bold">{formData.product_type}</span> product. 
										Price and stock are managed per variation in the <span class="font-bold underline">Variants</span> tab.
									</p>
								</div>
							{/if}

							<div class="pt-4 flex items-center justify-between">
								<div class="flex items-center space-x-3">
									<button 
										onclick={() => formData.active = !formData.active}
										aria-label={formData.active ? 'Deactivate product' : 'Activate product'}
										class="w-12 h-6 rounded-full p-1 transition-colors {formData.active ? 'bg-indigo-600' : 'bg-slate-300'}"
									>
										<div class="bg-white w-4 h-4 rounded-full transition-transform {formData.active ? 'translate-x-6' : 'translate-x-0'} shadow-sm"></div>
									</button>
									<span class="text-sm font-bold {formData.active ? 'text-indigo-600' : 'text-slate-500'}">
										{formData.active ? 'Available for purchase' : 'Draft / Hidden'}
									</span>
								</div>
							</div>
						</div>
					</div>
				{:else if activeTab === 'metadata'}
					<div class="space-y-8">
						<section>
							<h3 class="text-sm font-bold uppercase text-slate-400 mb-4 flex items-center">
								<Check size={14} class="mr-2 text-green-500" />
								Select Product Type
							</h3>
							<ProductTypeSelector 
								value={formData.product_type} 
								onSelect={(v) => {
									formData.product_type = v as any;
									if (v === 'generic') activeTab = 'basic';
								}} 
							/>
						</section>

						<section class="p-6 bg-slate-50 rounded-2xl border border-slate-100">
							<h3 class="text-sm font-bold uppercase text-slate-400 mb-6 underline decoration-slate-200 underline-offset-8">
								Descriptive Specifications
							</h3>
							<MetadataForm 
								type={formData.product_type} 
								metadata={formData.metadata} 
								onChange={(m) => formData.metadata = m} 
							/>
						</section>
					</div>
				{:else if activeTab === 'variants'}
					{#if productId}
						<VariantsTable
							{store}
							{productId}
							productTitle={formData.title}
							productSku={formData.sku}
							productType={formData.product_type}
						/>					{:else}
						<div class="py-20 flex flex-col items-center justify-center text-slate-400 text-center">
							<Layers size={48} strokeWidth={1} class="mb-4 opacity-30" />
							<p class="max-w-xs text-sm">
								Save your product first to start adding variations like color, size, or material tiers.
							</p>
							<Button 
								variant="primary"
								onclick={save}
								class="mt-6 px-8"
							>
								Save & Continue
							</Button>
						</div>
					{/if}
				{/if}
			{/if}
		</div>

		<!-- Footer -->
		<div class="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
			{#if error}
				<div class="flex items-center text-red-600 text-sm font-medium">
					<AlertCircle size={16} class="mr-2" />
					{error}
				</div>
			{:else}
				<div></div>
			{/if}
			<div class="flex items-center space-x-3">
				<Button 
					variant="secondary"
					onclick={onClose} 
					class="px-6"
				>
					Cancel
				</Button>
				<Button 
					variant="primary"
					onclick={save} 
					disabled={saving}
					class="px-8 min-w-35"
				>
					{#if saving}
						<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
					{/if}
					<Save size={18} class={saving ? 'hidden' : 'mr-2'} />
					{isEditing ? 'Update' : 'Create Product'}
				</Button>
			</div>
		</div>
	</div>
</div>
