<script lang="ts">
	import { onMount } from "svelte";
	import { Plus, Trash2, X, RefreshCw, Pencil } from "@lucide/svelte";
	import { activeStore } from "$lib/stores/activeStore.svelte.js";
	import Button from "$lib/components/ui/Button.svelte";
	import Card from "$lib/components/ui/Card.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Select from "$lib/components/ui/Select.svelte";
	import Badge from "$lib/components/ui/Badge.svelte";
	import {
		fetchSyncStatus,
		syncToGateway as doSync,
	} from "$lib/syncGateway.js";
	import type { Category } from "$lib/types/catalog.js";

	let categories = $state<Category[]>([]);
	let loading = $state(true);

	// ── Sync banner state ──────────────────────────────────────────────────────
	let dirtyCount = $state(0);
	let syncing = $state(false);
	let syncSuccess = $state("");
	let syncError = $state("");
	let saving = $state(false);

	let dirtyBreakdown = $derived.by(() => {
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
		} catch (e: any) {
			syncError = e?.message ?? "Sync failed";
			setTimeout(() => (syncError = ""), 6000);
		}
		syncing = false;
	}

	let showModal = $state(false);
	let isEditing = $state(false);
	let editingCategoryId = $state<number | null>(null);

	let formData = $state({
		name: "",
		parent_id: "" as string,
	});
	let erroredFields = $state<Set<string>>(new Set());

	let productCounts = $state<Record<number, number>>({});
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
				const products: any[] = data.products || [];

				const counts: Record<number, number> = {};
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

	const openEditModal = (category: Category) => {
		isEditing = true;
		editingCategoryId = category.id;
		formData = {
			name: category.name,
			parent_id: category.parent_id?.toString() || "",
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

	const deleteCategory = async (categoryId: number) => {
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

	const getCategoryParentName = (parentId: number | null) => {
		if (!parentId) return "—";
		const parent = categories.find((c) => c.id === parentId);
		return parent ? parent.name : "—";
	};

	const getSelectableCategories = $derived(
		categories.filter((c) => !isEditing || c.id !== editingCategoryId),
	);
</script>

<svelte:head><title>Categories — Prompt Commerce</title></svelte:head>

<div class="px-6 pt-6 pb-20">
	<div class="max-w-6xl mx-auto">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-2xl font-black text-gray-900 tracking-tight">Categories</h1>
			<Button
				onclick={openAddModal}
				variant="primary"
			>
				<Plus size={18} />
				Add category
			</Button>
		</div>

		<!-- Sync banner -->
		{#if syncing}
			<div
				class="flex items-center gap-3 mb-6 rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-800"
			>
				<RefreshCw size={15} class="animate-spin shrink-0" />
				<span>Syncing changes to gateway…</span>
			</div>
		{:else if syncSuccess}
			<div
				class="flex items-center gap-3 mb-6 rounded-2xl border border-green-200 bg-green-50/50 px-4 py-3 text-sm text-green-800"
			>
				<span class="shrink-0">✓</span>
				<span>{syncSuccess}</span>
			</div>
		{:else if syncError}
			<div
				class="flex items-center gap-3 mb-6 rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-700"
			>
				<span class="shrink-0">⚠</span>
				<span>{syncError}</span>
			</div>
		{:else if dirtyCount > 0}
			<div
				class="mb-6 flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm text-orange-800"
			>
				<div class="flex items-center gap-2">
					<RefreshCw
						size={16}
						class="text-orange-600 animate-spin-slow"
					/>
					<span class="font-medium">
						{dirtyCount} item{dirtyCount === 1 ? "" : "s"} not yet synced.
						<span class="text-orange-600/70 font-normal ml-1">
							({dirtyBreakdown.activeDirty} new/edited · {dirtyBreakdown.deletedCount}
							deleted)
						</span>
					</span>
				</div>
				<Button
					onclick={runSync}
					variant="primary"
					class="bg-orange-600 hover:bg-orange-700 h-8 text-[10px]"
				>
					Sync now
				</Button>
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
			<Card class="p-20 text-center">
				<div
					class="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
				>
					<div class="w-10 h-10 border-4 border-gray-100 rounded-lg"></div>
				</div>
				<h3 class="text-lg font-bold text-gray-900">
					No categories found
				</h3>
				<p class="text-sm text-gray-500 mt-2 max-w-[300px] mx-auto">
					You haven't added any categories to this store yet.
				</p>
				<Button
					variant="primary"
					onclick={openAddModal}
					class="mt-6 mx-auto"
				>
					Add your first category
				</Button>
			</Card>
		{:else}
			<Card class="overflow-hidden p-0">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50/80 border-b border-gray-100">
							<tr>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Name</th
								>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Parent Category</th
								>
								<th
									class="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Products</th
								>
								<th
									class="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-400"
									>Actions</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each categories as category (category.id)}
								<tr class="hover:bg-gray-50/50 transition-colors">
									<td class="px-6 py-4 font-bold text-gray-900"
										>{category.name}</td
									>
									<td class="px-6 py-4">
										<Badge variant="secondary" class="border-none font-medium">
											{getCategoryParentName(category.parent_id)}
										</Badge>
									</td>
									<td class="px-6 py-4">
										<span class="font-black text-gray-900">{productCounts[category.id] || 0}</span>
										<span class="text-[10px] text-gray-400 font-bold ml-1 uppercase">items</span>
									</td>
									<td class="px-6 py-4 text-right">
										<div class="flex items-center justify-end gap-1">
											<Button
												variant="secondary"
												size="sm"
												onclick={() => openEditModal(category)}
												class="p-2 border-none h-auto"
											>
												<Pencil size={15} />
											</Button>
											<Button
												variant="secondary"
												size="sm"
												onclick={() => deleteCategory(category.id)}
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
		{/if}
	</div>

	{#if showModal}
		<div
			class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
			onclick={(e) => e.target === e.currentTarget && closeModal()}
			onkeydown={(e) => e.key === "Escape" && closeModal()}
			role="presentation"
		>
			<Card
				class="w-full max-w-lg shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-200"
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				<div
					class="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50"
				>
					<h2
						id="modal-title"
						class="text-xl font-black text-gray-900"
					>
						{isEditing ? "Edit Category" : "Add Category"}
					</h2>
					<Button
						onclick={closeModal}
						variant="secondary"
						size="sm"
						class="p-1 border-none h-auto text-gray-400 hover:text-gray-600"
					>
						<X size={20} />
					</Button>
				</div>

				<div class="p-6 space-y-6">
					<Input
						id="category-name"
						label="Category Name"
						bind:value={formData.name}
						oninput={() => erroredFields.delete("name")}
						placeholder="e.g. Smartphones, Summer Collection"
						error={erroredFields.has('name') ? 'Name is required' : ''}
					/>

					<div class="space-y-1.5">
						<label
							for="category-parent"
							class="text-[11px] font-black uppercase tracking-widest text-gray-400 px-1"
							>Parent Category</label
						>
						<Select
							id="category-parent"
							bind:value={formData.parent_id}
							options={[
								{ value: '', label: 'None (Root Category)' },
								...getSelectableCategories.map(cat => ({ value: cat.id.toString(), label: cat.name }))
							]}
						/>
					</div>
				</div>

				<div class="flex gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
					<Button
						onclick={closeModal}
						variant="secondary"
						class="flex-1"
						disabled={saving}
					>
						Cancel
					</Button>
					<Button
						onclick={saveCategory}
						variant="primary"
						class="flex-1"
						disabled={saving}
					>
						{#if saving}
							<RefreshCw size={16} class="animate-spin" />
							Syncing...
						{:else}
							{isEditing ? "Update Category" : "Create Category"}
						{/if}
					</Button>
				</div>
			</Card>
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
