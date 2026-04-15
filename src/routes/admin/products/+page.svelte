<script lang="ts">
	import { onMount } from "svelte";
	import {
		ChevronLeft,
		ChevronRight,
		Plus,
		Pencil,
		Eye,
		EyeOff,
		Trash2,
		X,
		RefreshCw,
		Search,
		Box,
		Shirt,
		Utensils,
		Smartphone,
		Plane,
	} from "@lucide/svelte";
	import { activeStore } from "$lib/stores/activeStore.svelte.js";
	import ProductModal from "$lib/components/products/ProductModal.svelte";
	import Button from "$lib/components/ui/Button.svelte";
	import Card from "$lib/components/ui/Card.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Select from "$lib/components/ui/Select.svelte";
	import Badge from "$lib/components/ui/Badge.svelte";
	import SyncBanner from "$lib/components/SyncBanner.svelte";
	import {
		fetchSyncStatus,
		syncToGateway as doSync,
	} from "$lib/syncGateway.js";
	import type { Product, Category } from "$lib/types/catalog.js";
	import type { SyncBannerInstance } from "$lib/types/components.js";

	let products = $state<Product[]>([]);
	let loading = $state(true);

	// ── Sync banner state ──────────────────────────────────────────────────────
	let syncBanner = $state<SyncBannerInstance>();

	async function loadDirtyCount() {
		syncBanner?.loadDirtyCount();
	}
	let currentPage = $state(1);
	let totalCount = $state(0);
	let itemsPerPage = 20;

	let searchQuery = $state("");
	let activeFilter = $state("all");
	let searchTimeout = $state<number | null>(null);

	let showModal = $state(false);
	let isEditing = $state(false);
	let editingProductId = $state<number | null>(null);

	let categories = $state<Category[]>([]);

	let toasts = $state<{ id: number; message: string; type: string }[]>([]);

	const showToast = (
		message: string,
		type: "success" | "error" = "success",
	) => {
		const id = Date.now();
		toasts = [...toasts, { id, message, type }];
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
		}, 3500);
	};

	const getAuthHeaders = () => {
		const token = localStorage.getItem("pc_token");
		return {
			Authorization: `Bearer ${token}`,
		};
	};

	const loadCategories = async () => {
		try {
			const response = await fetch(
				`/api/categories?store=${activeStore.slug}`,
				{
					headers: getAuthHeaders(),
				},
			);
			if (response.ok) {
				categories = await response.json();
			}
		} catch (error) {
			console.error("Failed to load categories:", error);
		}
	};

	const loadProducts = async () => {
		loading = true;
		try {
			const params = new URLSearchParams({
				store: activeStore.slug || "",
				page: String(currentPage),
				limit: String(itemsPerPage),
				q: searchQuery,
			});

			if (activeFilter !== "all") {
				params.append("active", activeFilter === "active" ? "1" : "0");
			}

			const response = await fetch(`/api/products?${params}`, {
				headers: getAuthHeaders(),
			});

			if (response.ok) {
				const data = await response.json();
				products = data.products || [];
				totalCount = data.totalCount || 0;
			}
		} catch (error) {
			console.error("Failed to load products:", error);
			showToast("Failed to load products", "error");
		} finally {
			loading = false;
		}
	};

	let dirtyBreakdown = $derived.by(() => {
		const deletedCount = products.filter(
			(p) => !p.is_synced && p.deleted_at,
		).length;
		const activeDirty = products.filter(
			(p) => !p.is_synced && !p.deleted_at,
		).length;
		return { deletedCount, activeDirty };
	});

	const debouncedSearch = () => {
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = window.setTimeout(() => {
			currentPage = 1;
			loadProducts();
			searchTimeout = null;
		}, 300);
	};

	const handleFilterChange = (e: Event) => {
		activeFilter = (e.target as HTMLSelectElement).value;
		currentPage = 1;
		loadProducts();
	};

	const openAddModal = () => {
		isEditing = false;
		editingProductId = null;
		showModal = true;
	};

	const openEditModal = (productId: number) => {
		isEditing = true;
		editingProductId = productId;
		showModal = true;
	};

	const deleteProduct = async (productId: number) => {
		if (!confirm("Are you sure you want to delete this product?")) return;

		try {
			const response = await fetch(
				`/api/products/${productId}?store=${activeStore.slug}`,
				{
					method: "DELETE",
					headers: getAuthHeaders(),
				},
			);

			if (response.ok) {
				showToast("Product deleted", "success");
				loadProducts();
				loadDirtyCount();
			} else {
				showToast("Failed to delete product", "error");
			}
		} catch (error) {
			console.error("Delete error:", error);
			showToast("Failed to delete product", "error");
		}
	};

	const toggleProductVisibility = async (product: Product) => {
		const newStatus = !product.active;
		try {
			const formDataObj = new FormData();
			formDataObj.append("active", String(newStatus ? 1 : 0));

			const response = await fetch(
				`/api/products/${product.id}?store=${activeStore.slug}`,
				{
					method: "PATCH",
					headers: getAuthHeaders(),
					body: formDataObj,
				},
			);

			if (response.ok) {
				products = products.map((p) =>
					p.id === product.id ? { ...p, active: newStatus } : p,
				);
				showToast(
					newStatus ? "Product activated" : "Product deactivated",
					"success",
				);
			}
		} catch (error) {
			console.error("Toggle error:", error);
			showToast("Failed to update product", "error");
		}
	};

	const closeModal = () => {
		showModal = false;
		editingProductId = null;
	};

	onMount(() => {
		if (activeStore.slug) {
			loadCategories();
			loadProducts();
			loadDirtyCount();
		}
	});

	const totalPages = $derived(Math.ceil(totalCount / itemsPerPage));
	const canPrevious = $derived(currentPage > 1);
	const canNext = $derived(currentPage < totalPages);
</script>

<svelte:head><title>Products — Prompt Commerce</title></svelte:head>

<div class="px-6 pt-6 pb-20">
	<div class="max-w-6xl mx-auto">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-2xl font-black text-gray-900 tracking-tight">
				Products
			</h1>
		</div>

		<SyncBanner bind:this={syncBanner} {dirtyBreakdown} />

		<Card class="p-4 mb-6">
			<div class="flex flex-col md:flex-row gap-4">
				<div class="flex-1 relative">
					<Search
						size={18}
						class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
					/>
					<Input
						type="text"
						placeholder="Search products..."
						value={searchQuery}
						oninput={debouncedSearch}
						class="pl-10"
					/>
				</div>
				<div class="flex gap-4">
					<Select
						value={activeFilter}
						onchange={handleFilterChange}
						class="w-32"
						options={[
							{ value: "all", label: "All" },
							{ value: "active", label: "Active" },
							{ value: "inactive", label: "Inactive" },
						]}
					/>
					<Button
						onclick={openAddModal}
						variant="primary"
						class="whitespace-nowrap"
					>
						<Plus size={18} />
						Add product
					</Button>
				</div>
			</div>
		</Card>

		{#if loading}
			<div class="space-y-3">
				{#each Array(5) as _}
					<div
						class="bg-white rounded-lg h-16 animate-pulse border border-gray-200"
					></div>
				{/each}
			</div>
		{:else if products.length === 0}
			<Card class="p-20 text-center">
				<div
					class="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
				>
					<Search size={32} class="text-gray-300" />
				</div>
				<h3 class="text-lg font-bold text-gray-900">
					No products found
				</h3>
				<p class="text-sm text-gray-500 mt-2 max-w-[400px] mx-auto">
					{#if searchQuery || activeFilter !== "all"}
						No products match your current search or filters.
						<Button
							variant="secondary"
							size="sm"
							onclick={() => {
								searchQuery = "";
								activeFilter = "all";
								loadProducts();
							}}
							class="mt-4 mx-auto"
						>
							Clear all filters
						</Button>
					{:else}
						You haven't added any products to this store yet.<br />
						<Button
							variant="primary"
							onclick={openAddModal}
							class="mt-4 mx-auto"
						>
							<Plus /> Add your first product
						</Button>
					{/if}
				</p>
			</Card>
		{:else}
			<Card class="overflow-hidden p-0">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50/80 border-b border-gray-100">
							<tr>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Thumbnail</th
								>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Product</th
								>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>SKU</th
								>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Type</th
								>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Price</th
								>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Stock</th
								>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Status</th
								>
								<th
									class="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Actions</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each products as product (product.id)}
								<tr
									class="hover:bg-gray-50/50 transition-colors"
								>
									<td class="px-6 py-4">
										{#if product.images && product.images.length > 0}
											<div
												class="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-100"
											>
												<img
													src={typeof product
														.images[0] === "string"
														? product.images[0]
														: (
																product
																	.images[0] as any
															).url}
													alt={product.title}
													class="w-full h-full object-cover"
												/>
											</div>
										{:else}
											<div
												class="w-12 h-12 rounded-xl bg-gray-100 border border-gray-100 flex items-center justify-center text-gray-300"
											>
												<Box size={20} />
											</div>
										{/if}
									</td>
									<td class="px-6 py-4">
										<div
											class="font-bold text-gray-900 leading-tight"
										>
											{product.title}
										</div>
										<div
											class="text-[10px] text-gray-400 font-medium mt-0.5"
										>
											ID: {product.id}
										</div>
									</td>
									<td class="px-6 py-4">
										<Badge
											variant="secondary"
											class="font-mono text-[10px] border-none"
										>
											{product.sku || "N/A"}
										</Badge>
									</td>
									<td class="px-6 py-4">
										<div
											class="flex items-center gap-1.5 grayscale opacity-60"
										>
											{#if product.product_type === "wearable"}
												<Shirt size={14} />
											{:else if product.product_type === "food"}
												<Utensils size={14} />
											{:else if product.product_type === "device"}
												<Smartphone size={14} />
											{:else if product.product_type === "travel"}
												<Plane size={14} />
											{:else}
												<Box size={14} />
											{/if}
											<span
												class="text-[10px] font-bold uppercase tracking-tighter"
												>{product.product_type}</span
											>
										</div>
									</td>
									<td class="px-6 py-4">
										<div class="flex flex-col">
											<span
												class="font-black text-gray-900"
											>
												₱{(product.variant_count &&
												product.variant_count > 0
													? product.min_price || 0
													: product.price || 0
												).toLocaleString("en-PH", {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												})}
											</span>
											{#if product.variant_count && product.variant_count > 0}
												<Badge
													class="bg-blue-50 text-blue-600 border-none px-1 text-[9px] mt-1 w-fit"
													>Variants</Badge
												>
											{/if}
										</div>
									</td>
									<td class="px-6 py-4">
										<div class="flex flex-col">
											<span
												class="font-bold {(product.variant_count &&
												product.variant_count > 0
													? product.total_stock || 0
													: product.stock_quantity ||
														0) <= 5
													? 'text-orange-600'
													: 'text-gray-900'}"
											>
												{product.variant_count &&
												product.variant_count > 0
													? product.total_stock
													: product.stock_quantity}
											</span>
											{#if product.variant_count && product.variant_count > 0}
												<span
													class="text-[9px] text-gray-400 font-medium"
													>{product.variant_count} types</span
												>
											{/if}
										</div>
									</td>
									<td class="px-6 py-4">
										{#if product.active}
											<Badge
												class="bg-green-50 text-green-700 border-green-100"
												>Active</Badge
											>
										{:else}
											<Badge
												class="bg-gray-100 text-gray-500 border-gray-200"
												>Draft</Badge
											>
										{/if}
									</td>
									<td class="px-6 py-4 text-right">
										<div
											class="flex items-center justify-end gap-1"
										>
											<Button
												variant="secondary"
												size="sm"
												onclick={() =>
													openEditModal(product.id)}
												class="p-2 border-none h-auto"
											>
												<Pencil size={15} />
											</Button>
											<Button
												variant="secondary"
												size="sm"
												onclick={() =>
													toggleProductVisibility(
														product,
													)}
												class="p-2 border-none h-auto"
											>
												{#if product.active}
													<Eye size={15} />
												{:else}
													<EyeOff size={15} />
												{/if}
											</Button>
											<Button
												variant="secondary"
												size="sm"
												onclick={() =>
													deleteProduct(product.id)}
												class="p-2 border-none h-auto text-red-500 hover:text-red-700 hover:bg-red-50"
											>
												<Trash2 size={15} />
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>

			<div class="mt-6 flex items-center justify-between">
				<div
					class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]"
				>
					Page {currentPage} of {totalPages || 1}
				</div>
				<div class="flex gap-2">
					<Button
						onclick={() => {
							if (canPrevious) {
								currentPage -= 1;
								loadProducts();
							}
						}}
						disabled={!canPrevious}
						variant="secondary"
						size="sm"
						class="flex items-center gap-1 border-gray-200"
					>
						<ChevronLeft size={16} />
						Previous
					</Button>
					<Button
						onclick={() => {
							if (canNext) {
								currentPage += 1;
								loadProducts();
							}
						}}
						disabled={!canNext}
						variant="secondary"
						size="sm"
						class="flex items-center gap-1 border-gray-200"
					>
						Next
						<ChevronRight size={16} />
					</Button>
				</div>
			</div>
		{/if}
	</div>

	{#if showModal}
		<ProductModal
			store={activeStore.slug || ""}
			{isEditing}
			productId={editingProductId}
			{categories}
			onClose={closeModal}
			onSave={() => {
				loadProducts();
				loadDirtyCount();
			}}
		/>
	{/if}

	<div class="fixed top-4 right-4 z-50 space-y-2">
		{#each toasts as toast (toast.id)}
			<div
				class={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg text-white ${
					toast.type === "success" ? "bg-green-600" : "bg-red-600"
				}`}
			>
				{toast.message}
			</div>
		{/each}
	</div>
</div>
