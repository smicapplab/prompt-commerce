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
	} from "@lucide/svelte";
	import { activeStore } from "$lib/stores/activeStore.svelte.js";
	import {
		fetchSyncStatus,
		syncToGateway as doSync,
	} from "$lib/syncGateway.js";
	import type { Product, Category } from "$lib/types/catalog.js";

	let products = $state<Product[]>([]);
	let loading = $state(true);

	// ── Sync banner state ──────────────────────────────────────────────────────
	let dirtyCount = $state(0);
	let syncing = $state(false);
	let syncSuccess = $state("");
	let syncError = $state("");
	let saving = $state(false);

	async function loadDirtyCount() {
		if (!activeStore.slug) return;
		const s = await fetchSyncStatus(activeStore.slug).catch(() => null);
		dirtyCount = s?.dirty ?? 0;
	}

	async function runSync() {
		if (!activeStore.slug || syncing) return;
		syncing = true;
		syncSuccess = "";
		syncError = "";
		try {
			syncSuccess = await doSync(activeStore.slug);
			dirtyCount = 0;
			setTimeout(() => (syncSuccess = ""), 5000);
		} catch (e: any) {
			syncError = e?.message ?? "Sync failed";
			setTimeout(() => (syncError = ""), 6000);
		}
		syncing = false;
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

	let formData = $state<{
		title: string;
		sku: string;
		description: string;
		category_id: string | number;
		price: string | number;
		stock_quantity: string | number;
		active: boolean;
		tags: string;
		images: any[];
		images_urls: string[];
	}>({
		title: "",
		sku: "",
		description: "",
		category_id: "",
		price: "",
		stock_quantity: "",
		active: true,
		tags: "",
		images: [],
		images_urls: [],
	});
	let erroredFields = $state(new Set<string>());

	let categories = $state<Category[]>([]);
	let newImageFiles = $state<File[]>([]);
	let imagePreviewUrls = $state<string[]>([]);

	let toasts = $state<{ id: number; message: string; type: string }[]>([]);

	const showToast = (message: string, type: "success" | "error" = "success") => {
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

	const handleFilterChange = (e: any) => {
		activeFilter = e.target.value;
		currentPage = 1;
		loadProducts();
	};

	const openAddModal = () => {
		isEditing = false;
		editingProductId = null;
		formData = {
			title: "",
			sku: "",
			description: "",
			category_id: "",
			price: "",
			stock_quantity: "",
			active: true,
			tags: "",
			images: [],
			images_urls: [],
		};
		newImageFiles = [];
		imagePreviewUrls = [];
		showModal = true;
		erroredFields.clear();
	};

	const openEditModal = async (productId: number) => {
		isEditing = true;
		editingProductId = productId;
		loading = true;

		try {
			const response = await fetch(
				`/api/products/${productId}?store=${activeStore.slug}`,
				{
					headers: getAuthHeaders(),
				},
			);

			if (response.ok) {
				const product = await response.json();
				formData = {
					title: product.title || "",
					sku: product.sku || "",
					description: product.description || "",
					category_id: product.category_id || "",
					price: product.price || "",
					stock_quantity: product.stock_quantity || "",
					active: !!product.active,
					tags: (product.tags || []).join(", "),
					images: product.images || [],
					images_urls: (product.images || []).map(
						(img: any) => img.url || img,
					),
				};
				newImageFiles = [];
				imagePreviewUrls = [];
				showModal = true;
				erroredFields.clear();
			}
		} catch (error) {
			console.error("Failed to load product:", error);
			showToast("Failed to load product", "error");
		} finally {
			loading = false;
		}
	};

	const handleImageSelect = (e: any) => {
		const files = Array.from(e.target.files || []) as File[];
		newImageFiles = [...newImageFiles, ...files];

		files.forEach((file) => {
			const reader = new FileReader();
			reader.onload = (event) => {
				const res = event.target?.result;
				if (typeof res === "string") {
					imagePreviewUrls = [...imagePreviewUrls, res];
				}
			};
			reader.readAsDataURL(file);
		});
	};

	const removeExistingImage = (index: number) => {
		formData.images_urls = formData.images_urls.filter(
			(_, i) => i !== index,
		);
	};

	const removeNewImage = (index: number) => {
		newImageFiles = newImageFiles.filter((_, i) => i !== index);
		imagePreviewUrls = imagePreviewUrls.filter((_, i) => i !== index);
	};

	const saveProduct = async () => {
		if (!formData.title.trim()) {
			erroredFields.add("title");
			showToast("Title is required", "error");
			return;
		}

		saving = true;
		const data = new FormData();
		data.append("title", formData.title);
		data.append("sku", formData.sku);
		data.append("description", formData.description);
		data.append("category_id", String(formData.category_id));
		data.append("price", String(parseFloat(String(formData.price)) || 0));
		data.append("stock_quantity", String(parseInt(String(formData.stock_quantity)) || 0));
		data.append("active", formData.active ? "1" : "0");
		data.append("tags", formData.tags);

		newImageFiles.forEach((file) => {
			data.append("images[]", file);
		});

		if (formData.images_urls.length > 0) {
			data.append("images_urls", formData.images_urls.join(","));
		} else {
			data.append("images_urls", "");
		}

		try {
			const url = isEditing
				? `/api/products/${editingProductId}?store=${activeStore.slug}`
				: `/api/products?store=${activeStore.slug}`;
			const method = isEditing ? "PATCH" : "POST";

			const response = await fetch(url, {
				method,
				headers: getAuthHeaders(),
				body: data,
			});

			if (response.ok) {
				showToast(
					isEditing ? "Product updated" : "Product created",
					"success",
				);
				showModal = false;
				loadProducts();
				loadDirtyCount();
			} else {
				showToast("Failed to save product", "error");
			}
		} catch (error) {
			console.error("Save error:", error);
			showToast("Failed to save product", "error");
		} finally {
			saving = false;
		}
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
		newImageFiles = [];
		imagePreviewUrls = [];
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
	const tagsArray = $derived(
		formData.tags
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t),
	);
</script>

<svelte:head><title>Products — Prompt Commerce</title></svelte:head>

<div class="min-h-screen bg-gray-50 p-8">
	<div class="max-w-7xl mx-auto">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-2xl font-bold text-gray-900">Products</h1>
		</div>

		<!-- Sync banner -->
		{#if syncing}
			<div
				class="flex items-center gap-3 mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
			>
				<RefreshCw size={15} class="animate-spin shrink-0" />
				<span>Syncing changes to gateway…</span>
			</div>
		{:else if syncSuccess}
			<div
				class="flex items-center gap-3 mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
			>
				<span class="shrink-0">✓</span>
				<span>{syncSuccess}</span>
			</div>
		{:else if syncError}
			<div
				class="flex items-center gap-3 mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
			>
				<span class="shrink-0">⚠</span>
				<span>{syncError}</span>
			</div>
		{:else if dirtyCount > 0}
			<div
				class="mb-6 flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800"
			>
				<div class="flex items-center gap-2">
					<RefreshCw
						size={16}
						class="text-orange-600 animate-spin-slow"
					/>
					<span class="font-medium">
						{dirtyCount} item{dirtyCount === 1 ? "" : "s"} not yet synced.
						<span class="text-orange-600/70 font-normal ml-1">
							({dirtyBreakdown.activeDirty} new/edited · {dirtyBreakdown
								.deletedCount} deleted)
						</span>
					</span>
				</div>
				<button
					onclick={runSync}
					class="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors shadow-sm"
				>
					Sync now
				</button>
			</div>
		{/if}

		<div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
			<div class="flex gap-4 mb-4">
				<input
					type="text"
					placeholder="Search products..."
					value={searchQuery}
					oninput={debouncedSearch}
					class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<select
					value={activeFilter}
					onchange={handleFilterChange}
					class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="all">All</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
				</select>
				<button
					onclick={openAddModal}
					class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
				>
					<Plus size={18} />
					Add product
				</button>
			</div>
		</div>

		{#if loading}
			<div class="space-y-3">
				{#each Array(5) as _}
					<div
						class="bg-white rounded-lg h-16 animate-pulse border border-gray-200"
					></div>
				{/each}
			</div>
		{:else if products.length === 0}
			<div
				class="bg-white rounded-xl border border-gray-200 p-12 text-center"
			>
				<div class="text-center py-12">
					<div
						class="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
					>
						<Search size={24} class="text-gray-400" />
					</div>
					<h3 class="text-sm font-medium text-gray-900">
						No products found
					</h3>
					<p class="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto">
						{#if searchQuery || activeFilter !== "all"}
							No products match your current search or filters.
							<button
								onclick={() => {
									searchQuery = "";
									activeFilter = "all";
									loadProducts();
								}}
								class="text-blue-600 hover:underline block mt-2 mx-auto"
								>Clear all filters</button
							>
						{:else}
							You haven't added any products to this store yet.
							<button
								onclick={openAddModal}
								class="text-blue-600 hover:underline block mt-2 mx-auto"
								>Add your first product</button
							>
						{/if}
					</p>
				</div>
			</div>
		{:else}
			<div
				class="bg-white rounded-xl border border-gray-200 overflow-hidden"
			>
				<table class="w-full text-sm">
					<thead class="bg-gray-50 border-b border-gray-200">
						<tr>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Thumbnail</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Title</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>SKU</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Category</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Price</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Stock</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Status</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each products as product (product.id)}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4">
									{#if product.images && product.images.length > 0}
										<img
											src={typeof product.images[0] ===
											"string"
												? product.images[0]
												: product.images[0].url}
											alt={product.title}
											class="w-10 h-10 rounded object-cover"
										/>
									{:else}
										<div
											class="w-10 h-10 rounded bg-gray-200"
										></div>
									{/if}
								</td>
								<td class="px-6 py-4">
									<div class="font-medium text-gray-900">
										{product.title}
									</div>
									<div
										class="text-xs text-gray-500 line-clamp-1"
									>
										{product.description ||
											"No description"}
									</div>
								</td>
								<td class="px-6 py-4 text-gray-700"
									>{product.sku || "—"}</td
								>
								<td class="px-6 py-4 text-gray-700"
									>{product.category_name || "—"}</td
								>
								<td class="px-6 py-4 font-medium text-gray-900">
									₱{parseFloat(
										product.price?.toString() || "0",
									).toLocaleString("en-PH", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</td>
								<td class="px-6 py-4">
									<span
										class={product.stock_quantity <= 5
											? "text-orange-600 font-medium"
											: "text-gray-700"}
									>
										{product.stock_quantity}
									</span>
								</td>
								<td class="px-6 py-4">
									{#if product.active}
										<span
											class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
											>Active</span
										>
									{:else}
										<span
											class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600"
											>Inactive</span
										>
									{/if}
								</td>
								<td class="px-6 py-4">
									<div class="flex items-center gap-2">
										<button
											onclick={() =>
												openEditModal(product.id)}
											class="p-1.5 hover:bg-gray-100 rounded text-gray-600"
											title="Edit"
										>
											<Pencil size={16} />
										</button>
										<button
											onclick={() =>
												toggleProductVisibility(
													product,
												)}
											class="p-1.5 hover:bg-gray-100 rounded text-gray-600"
											title={product.active
												? "Hide"
												: "Show"}
										>
											{#if product.active}
												<Eye size={16} />
											{:else}
												<EyeOff size={16} />
											{/if}
										</button>
										<button
											onclick={() =>
												deleteProduct(product.id)}
											class="p-1.5 hover:bg-red-50 rounded text-red-600"
											title="Delete"
										>
											<Trash2 size={16} />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-6 flex items-center justify-between">
				<div class="text-sm text-gray-600">
					Page {currentPage} of {totalPages || 1}
				</div>
				<div class="flex gap-2">
					<button
						onclick={() => {
							if (canPrevious) {
								currentPage -= 1;
								loadProducts();
							}
						}}
						disabled={!canPrevious}
						class="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
					>
						<ChevronLeft size={16} />
						Previous
					</button>
					<button
						onclick={() => {
							if (canNext) {
								currentPage += 1;
								loadProducts();
							}
						}}
						disabled={!canNext}
						class="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
					>
						Next
						<ChevronRight size={16} />
					</button>
				</div>
			</div>
		{/if}
	</div>

	{#if showModal}
		<div
			class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
			onkeydown={(e) => e.key === "Escape" && closeModal()}
			role="presentation"
		>
			<div
				class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col"
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				<div
					class="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10"
				>
					<h2
						id="modal-title"
						class="text-xl font-bold text-gray-900"
					>
						{isEditing ? "Edit Product" : "Add Product"}
					</h2>
					<button
						onclick={closeModal}
						class="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
					>
						<X size={20} />
					</button>
				</div>

				<div class="p-6 space-y-4">
					<div>
						<label
							for="product-title"
							class="block text-sm font-medium text-gray-700 mb-1"
							>Title *</label
						>
						<input
							id="product-title"
							type="text"
							bind:value={formData.title}
							class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
							placeholder="Product name"
						/>
					</div>

					<div>
						<label
							for="product-sku"
							class="block text-sm font-medium text-gray-700 mb-1"
							>SKU</label
						>
						<input
							id="product-sku"
							type="text"
							bind:value={formData.sku}
							class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="SKU-123"
						/>
					</div>

					<div>
						<label
							for="product-description"
							class="block text-sm font-medium text-gray-700 mb-1"
							>Description</label
						>
						<textarea
							id="product-description"
							bind:value={formData.description}
							rows="3"
							class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
							placeholder="Product description"
						></textarea>
					</div>

					<div>
						<label
							for="product-category"
							class="block text-sm font-medium text-gray-700 mb-1"
							>Category</label
						>
						<select
							id="product-category"
							bind:value={formData.category_id}
							class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select a category</option>
							{#each categories as cat (cat.id)}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label
								for="product-price"
								class="block text-sm font-medium text-gray-700 mb-1"
								>Price</label
							>
							<input
								id="product-price"
								type="number"
								bind:value={formData.price}
								step="0.01"
								min="0"
								class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="0.00"
							/>
						</div>
						<div>
							<label
								for="product-stock"
								class="block text-sm font-medium text-gray-700 mb-1"
								>Stock</label
							>
							<input
								id="product-stock"
								type="number"
								bind:value={formData.stock_quantity}
								min="0"
								step="1"
								class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="0"
							/>
						</div>
					</div>

					<div>
						<label
							for="product-tags"
							class="block text-sm font-medium text-gray-700 mb-1"
							>Tags</label
						>
						<input
							id="product-tags"
							type="text"
							bind:value={formData.tags}
							class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="tag1, tag2, tag3"
						/>
						{#if tagsArray.length > 0}
							<div class="flex flex-wrap gap-2 mt-2">
								{#each tagsArray as tag (tag)}
									<span
										class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
										>{tag}</span
									>
								{/each}
							</div>
						{/if}
					</div>

					<div>
						<p class="block text-sm font-medium text-gray-700 mb-3">
							Status
						</p>
						<div class="flex items-center gap-3">
							<button
								onclick={() => (formData.active = true)}
								class={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
									formData.active
										? "bg-green-100 text-green-700"
										: "bg-gray-100 text-gray-700 hover:bg-gray-200"
								}`}
							>
								Active
							</button>
							<button
								onclick={() => (formData.active = false)}
								class={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
									!formData.active
										? "bg-red-100 text-red-700"
										: "bg-gray-100 text-gray-700 hover:bg-gray-200"
								}`}
							>
								Inactive
							</button>
						</div>
					</div>

					<div>
						<p class="block text-sm font-medium text-gray-700 mb-3">
							Images
						</p>
						{#if formData.images_urls.length > 0}
							<div class="mb-4">
								<p class="text-xs text-gray-600 mb-2">
									Existing images:
								</p>
								<div class="grid grid-cols-4 gap-2">
									{#each formData.images_urls as url, i (url)}
										<div class="relative">
											<img
												src={url}
												alt="Product"
												class="w-full h-20 rounded object-cover border border-gray-200"
											/>
											<button
												onclick={() =>
													removeExistingImage(i)}
												class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
											>
												<X size={14} />
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if imagePreviewUrls.length > 0}
							<div class="mb-4">
								<p class="text-xs text-gray-600 mb-2">
									New images:
								</p>
								<div class="grid grid-cols-4 gap-2">
									{#each imagePreviewUrls as url, i (url)}
										<div class="relative">
											<img
												src={url}
												alt="Preview"
												class="w-full h-20 rounded object-cover border border-gray-200"
											/>
											<button
												onclick={() =>
													removeNewImage(i)}
												class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
											>
												<X size={14} />
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<input
							type="file"
							multiple
							accept="image/*"
							onchange={handleImageSelect}
							class="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:hover:bg-gray-50"
						/>
					</div>
				</div>

				<div
					class="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 mt-auto"
				>
					<button
						onclick={closeModal}
						class="flex-1 border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 outline-none"
						disabled={saving}
					>
						Cancel
					</button>
					<button
						onclick={saveProduct}
						class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						disabled={saving}
					>
						{#if saving}
							<RefreshCw size={16} class="animate-spin" />
							{isEditing ? "Updating..." : "Creating..."}
						{:else}
							{isEditing ? "Update" : "Create"}
						{/if}
					</button>
				</div>
			</div>
		</div>
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
