<script>
	import { onMount } from "svelte";
	import { Plus, Edit2, Trash2, X, RefreshCw } from "@lucide/svelte";
	import { activeStore } from "$lib/stores/activeStore.svelte.js";
	import {
		fetchSyncStatus,
		syncToGateway as doSync,
	} from "$lib/syncGateway.js";

	let categories = $state([]);
	let loading = $state(true);

	// ── Sync banner state ──────────────────────────────────────────────────────
	let dirtyCount = $state(0);
	let syncing = $state(false);
	let syncSuccess = $state("");
	let syncError = $state("");
	let saving = $state(false);

	let dirtyBreakdown = $derived(() => {
		const deletedCount = categories.filter(
			(c) => !c.is_synced && c.deleted_at,
		).length;
		const activeDirty = categories.filter(
			(c) => !c.is_synced && !c.deleted_at,
		).length;
		return { deletedCount, activeDirty };
	});

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
		} catch (e) {
			syncError = e?.message ?? "Sync failed";
			setTimeout(() => (syncError = ""), 6000);
		}
		syncing = false;
	}

	let showModal = $state(false);
	let isEditing = $state(false);
	let editingCategoryId = $state(null);

	let formData = $state({
		name: "",
		parent_id: "",
	});
	let erroredFields = $state(new Set());

	let productCounts = $state({});
	let toasts = $state([]);

	const showToast = (message, type = "success") => {
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
		loading = true;
		try {
			const response = await fetch(
				`/api/categories?store=${activeStore.slug}`,
				{
					headers: getAuthHeaders(),
				},
			);

			if (response.ok) {
				categories = await response.json();
				loadProductCounts();
			}
		} catch (error) {
			console.error("Failed to load categories:", error);
			showToast("Failed to load categories", "error");
		} finally {
			loading = false;
		}
	};

	const loadProductCounts = async () => {
		try {
			const response = await fetch(
				`/api/products?store=${activeStore.slug}&limit=1000`,
				{
					headers: getAuthHeaders(),
				},
			);

			if (response.ok) {
				const data = await response.json();
				const products = data.products || [];

				const counts = {};
				categories.forEach((cat) => {
					counts[cat.id] = products.filter(
						(p) => p.category_id === cat.id,
					).length;
				});

				productCounts = counts;
			}
		} catch (error) {
			console.error("Failed to load product counts:", error);
		}
	};

	const openAddModal = () => {
		isEditing = false;
		editingCategoryId = null;
		formData = {
			name: "",
			parent_id: "",
		};
		showModal = true;
	};

	const openEditModal = (category) => {
		isEditing = true;
		editingCategoryId = category.id;
		formData = {
			name: category.name,
			parent_id: category.parent_id || "",
		};
		showModal = true;
	};

	const saveCategory = async () => {
		if (!formData.name.trim()) {
			erroredFields.add("name");
			showToast("Category name is required", "error");
			return;
		}

		saving = true;
		const data = {
			name: formData.name,
			parent_id: formData.parent_id || null,
		};

		try {
			const url = isEditing
				? `/api/categories/${editingCategoryId}?store=${activeStore.slug}`
				: `/api/categories?store=${activeStore.slug}`;
			const method = isEditing ? "PATCH" : "POST";

			const response = await fetch(url, {
				method,
				headers: {
					...getAuthHeaders(),
					"Content-Type": "application/json",
				},
				body: JSON.stringify(data),
			});

			if (response.ok) {
				showToast(
					isEditing ? "Category updated" : "Category created",
					"success",
				);
				showModal = false;
				loadCategories();
				loadDirtyCount();
			} else {
				showToast("Failed to save category", "error");
			}
		} catch (error) {
			console.error("Save error:", error);
			showToast("Failed to save category", "error");
		} finally {
			saving = false;
		}
	};

	const deleteCategory = async (categoryId) => {
		const count = productCounts[categoryId] || 0;

		let message = "Are you sure you want to delete this category?";
		if (count > 0) {
			message += ` ${count} product${count !== 1 ? "s" : ""} will lose their category.`;
		}

		if (!confirm(message)) return;

		try {
			const response = await fetch(
				`/api/categories/${categoryId}?store=${activeStore.slug}`,
				{
					method: "DELETE",
					headers: getAuthHeaders(),
				},
			);

			if (response.ok) {
				showToast("Category deleted", "success");
				loadCategories();
				loadDirtyCount();
			} else {
				showToast("Failed to delete category", "error");
			}
		} catch (error) {
			console.error("Delete error:", error);
			showToast("Failed to delete category", "error");
		}
	};

	const closeModal = () => {
		showModal = false;
	};

	onMount(() => {
		if (activeStore.slug) {
			loadCategories();
			loadDirtyCount();
		}
	});

	const getCategoryParentName = (parentId) => {
		if (!parentId) return "—";
		const parent = categories.find((c) => c.id === parentId);
		return parent ? parent.name : "—";
	};

	const getSelectableCategories = $derived(
		categories.filter((c) => !isEditing || c.id !== editingCategoryId),
	);
</script>

<svelte:head><title>Categories — Prompt Commerce</title></svelte:head>

<div class="min-h-screen bg-gray-50 p-8">
	<div class="max-w-4xl mx-auto">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-3xl font-bold text-gray-900">Categories</h1>
			<button
				onclick={openAddModal}
				class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
			>
				<Plus size={18} />
				Add category
			</button>
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
							({dirtyBreakdown().activeDirty} new/edited · {dirtyBreakdown()
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

		{#if loading}
			<div class="space-y-3">
				{#each Array(5) as _}
					<div
						class="bg-white rounded-lg h-16 animate-pulse border border-gray-200"
					></div>
				{/each}
			</div>
		{:else if categories.length === 0}
			<div
				class="bg-white rounded-xl border border-gray-200 p-12 text-center"
			>
				<p class="text-gray-500">
					No categories found. Create one to get started.
				</p>
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
								>Name</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Parent Category</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Products</th
							>
							<th
								class="px-6 py-3 text-left font-medium text-gray-700"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each categories as category (category.id)}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 font-medium text-gray-900"
									>{category.name}</td
								>
								<td class="px-6 py-4 text-gray-700"
									>{getCategoryParentName(
										category.parent_id,
									)}</td
								>
								<td class="px-6 py-4 text-gray-700"
									>{productCounts[category.id] || 0}</td
								>
								<td class="px-6 py-4">
									<div class="flex items-center gap-2">
										<button
											onclick={() =>
												openEditModal(category)}
											class="p-1.5 hover:bg-gray-100 rounded text-gray-600"
											title="Edit"
										>
											<Edit2 size={16} />
										</button>
										<button
											onclick={() =>
												deleteCategory(category.id)}
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
		{/if}
	</div>

	{#if showModal}
		<div
			class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
			onkeydown={(e) => e.key === "Escape" && closeModal()}
			role="presentation"
		>
			<div
				class="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				<div
					class="flex items-center justify-between p-6 border-b border-gray-200"
				>
					<h2
						id="modal-title"
						class="text-xl font-bold text-gray-900"
					>
						{isEditing ? "Edit Category" : "Add Category"}
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
							for="category-name"
							class="block text-sm font-medium text-gray-700 mb-1"
							>Name *</label
						>
						<input
							id="category-name"
							type="text"
							bind:value={formData.name}
							oninput={() => erroredFields.delete("name")}
							class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 {erroredFields.has(
								'name',
							)
								? 'border-red-500 bg-red-50'
								: 'border-gray-300'}"
							placeholder="Category name"
							autofocus
						/>
						{#if erroredFields.has("name")}
							<p class="text-xs text-red-600 mt-1">
								Name is required
							</p>
						{/if}
					</div>

					<div>
						<label
							for="category-parent"
							class="block text-sm font-medium text-gray-700 mb-1"
							>Parent Category</label
						>
						<select
							id="category-parent"
							bind:value={formData.parent_id}
							class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">None</option>
							{#each getSelectableCategories as cat (cat.id)}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
					<button
						onclick={closeModal}
						class="flex-1 border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 outline-none"
						disabled={saving}
					>
						Cancel
					</button>
					<button
						onclick={saveCategory}
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
