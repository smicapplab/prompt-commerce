<script lang="ts">
  import {
    Plus,
    Pencil,
    Trash2,
    Copy,
    Check,
    ToggleLeft,
    ToggleRight,
    Store,
    Search,
    Loader,
  } from "@lucide/svelte";

  interface StoreItem {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    gateway_key: string | null;
    active: number;
    created_at: string;
  }

  let stores = $state<StoreItem[]>([]);
  let loading = $state(true);
  let toast = $state("");
  let toastType = $state<"success" | "error">("success");
  let showModal = $state(false);
  let editTarget = $state<StoreItem | null>(null);
  let copiedKey = $state<number | null>(null);

  // Add-store flow: enter key → lookup → confirm
  let keyInput = $state("");
  let lookupState = $state<"idle" | "loading" | "found" | "error">("idle");
  let lookupError = $state("");
  let looked = $state<{
    slug: string;
    name: string;
    mcpServerUrl: string;
  } | null>(null);

  // Edit form (used only when editing an existing store)
  let form = $state({ slug: "", name: "", description: "", gateway_key: "" });

  function token() {
    return localStorage.getItem("pc_token") ?? "";
  }

  async function load() {
    loading = true;
    const res = await fetch("/api/stores", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    stores = res.ok ? await res.json() : [];
    loading = false;
  }

  function showToast(msg: string, type: "success" | "error" = "success") {
    toast = msg;
    toastType = type;
    setTimeout(() => (toast = ""), 3500);
  }

  function openCreate() {
    editTarget = null;
    keyInput = "";
    lookupState = "idle";
    lookupError = "";
    looked = null;
    showModal = true;
  }

  function openEdit(s: StoreItem) {
    editTarget = s;
    form = {
      slug: s.slug,
      name: s.name,
      description: s.description ?? "",
      gateway_key: s.gateway_key ?? "",
    };
    showModal = true;
  }

  async function lookupKey() {
    if (!keyInput.trim()) return;
    lookupState = "loading";
    lookupError = "";
    looked = null;

    const res = await fetch(
      `/api/stores/lookup?key=${encodeURIComponent(keyInput.trim())}`,
      {
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    const data = await res.json();

    if (!res.ok) {
      lookupState = "error";
      lookupError = data.error ?? "Store not found for this key.";
      return;
    }

    looked = data;
    lookupState = "found";
  }

  async function connectStore() {
    if (!looked) return;
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({
        slug: looked.slug,
        name: looked.name,
        gateway_key: keyInput.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Save failed", "error");
      return;
    }
    showToast("Store connected");
    showModal = false;
    load();
  }

  async function saveStore() {
    if (!editTarget) return;
    const res = await fetch(`/api/stores/${editTarget.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Save failed", "error");
      return;
    }
    showToast("Store updated");
    showModal = false;
    load();
  }

  async function toggleActive(s: StoreItem) {
    await fetch(`/api/stores/${s.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ active: s.active ? 0 : 1 }),
    });
    showToast(s.active ? "Store deactivated" : "Store activated");
    load();
  }

  async function deleteStore(s: StoreItem) {
    if (
      !confirm(
        `Delete "${s.name}"? This will also delete all its products, orders and conversations.`,
      )
    )
      return;
    const res = await fetch(`/api/stores/${s.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      showToast("Store deleted");
      load();
    } else showToast("Delete failed", "error");
  }

  async function copyKey(s: StoreItem) {
    if (!s.gateway_key) return;
    await navigator.clipboard.writeText(s.gateway_key);
    copiedKey = s.id;
    setTimeout(() => (copiedKey = null), 2000);
  }

  $effect(() => {
    load();
  });
</script>

<svelte:head><title>Stores — Prompt Commerce</title></svelte:head>

<!-- Toast -->
{#if toast}
  <div
    class="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg
    {toastType === 'success'
      ? 'bg-green-600 text-white'
      : 'bg-red-600 text-white'}"
  >
    {toast}
  </div>
{/if}

<div class="p-6">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Stores</h1>
      <p class="text-sm text-gray-500 mt-0.5">
        Manage stores hosted on this server
      </p>
    </div>
    <button
      onclick={openCreate}
      class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      <Plus class="w-4 h-4" /> Add store
    </button>
  </div>

  {#if loading}
    <div class="text-sm text-gray-400 py-12 text-center">Loading…</div>
  {:else if stores.length === 0}
    <div class="text-center py-16 text-gray-400">
      <Store class="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p class="text-sm">No stores yet. Add your first store to get started.</p>
    </div>
  {:else}
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-600">Name</th>
            <th class="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
            <th class="text-left px-4 py-3 font-medium text-gray-600"
              >Gateway Key</th
            >
            <th class="text-left px-4 py-3 font-medium text-gray-600">Status</th
            >
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each stores as s}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 font-medium text-gray-900">{s.name}</td>
              <td class="px-4 py-3 text-gray-500 font-mono text-xs">{s.slug}</td
              >
              <td class="px-4 py-3">
                {#if s.gateway_key}
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-gray-500"
                      >{s.gateway_key.slice(0, 12)}…</span
                    >
                    <button
                      onclick={() => copyKey(s)}
                      class="text-gray-400 hover:text-gray-600"
                    >
                      {#if copiedKey === s.id}<Check
                          class="w-3.5 h-3.5 text-green-500"
                        />{:else}<Copy class="w-3.5 h-3.5" />{/if}
                    </button>
                  </div>
                {:else}
                  <span class="text-gray-300 text-xs">Not set</span>
                {/if}
              </td>
              <td class="px-4 py-3">
                <button
                  onclick={() => toggleActive(s)}
                  class="flex items-center gap-1.5 text-xs"
                >
                  {#if s.active}
                    <ToggleRight class="w-5 h-5 text-green-500" />
                    <span class="text-green-600">Active</span>
                  {:else}
                    <ToggleLeft class="w-5 h-5 text-gray-400" />
                    <span class="text-gray-400">Inactive</span>
                  {/if}
                </button>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1 justify-end">
                  <button
                    onclick={() => openEdit(s)}
                    class="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    onclick={() => deleteStore(s)}
                    class="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                  >
                    <Trash2 class="w-4 h-4" />
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

<!-- Add / Edit Modal -->
{#if showModal}
  <div
    class="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
  >
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
      <div class="px-6 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-900">
          {editTarget ? "Edit store" : "Connect store"}
        </h2>
      </div>

      {#if editTarget}
        <!-- ── Edit mode: full form ── -->
        <div class="px-6 py-4 space-y-4">
          <div>
            <label
              for="edit-name"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Store name *</label
            >
            <input
              id="edit-name"
              bind:value={form.name}
              type="text"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              for="edit-slug"
              class="block text-sm font-medium text-gray-700 mb-1">Slug</label
            >
            <input
              id="edit-slug"
              bind:value={form.slug}
              type="text"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              for="edit-desc"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Description</label
            >
            <textarea
              id="edit-desc"
              bind:value={form.description}
              rows="2"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          <div>
            <label
              for="edit-key"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Gateway key</label
            >
            <input
              id="edit-key"
              bind:value={form.gateway_key}
              type="text"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onclick={() => (showModal = false)}
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >Cancel</button
          >
          <button
            onclick={saveStore}
            disabled={!form.slug || !form.name}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >Save changes</button
          >
        </div>
      {:else}
        <!-- ── Add mode: key → lookup → confirm ── -->
        <div class="px-6 py-5 space-y-4">
          <!-- Key input + lookup button -->
          <div>
            <label
              for="add-key"
              class="block text-sm font-medium text-gray-700 mb-1"
              >Platform key</label
            >
            <div class="flex gap-2">
              <input
                id="add-key"
                bind:value={keyInput}
                onkeydown={(e) => {
                  if (e.key === "Enter") lookupKey();
                }}
                type="text"
                placeholder="gk_…"
                class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onclick={lookupKey}
                disabled={!keyInput.trim() || lookupState === "loading"}
                class="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                {#if lookupState === "loading"}
                  <Loader class="w-4 h-4 animate-spin" />
                {:else}
                  <Search class="w-4 h-4" />
                {/if}
                Look up
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-1">
              Paste the key issued by the gateway admin.
            </p>
          </div>

          <!-- Error state -->
          {#if lookupState === "error"}
            <div
              class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {lookupError}
            </div>
          {/if}

          <!-- Found state: show store details read-only -->
          {#if lookupState === "found" && looked}
            <div
              class="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-2"
            >
              <p
                class="text-xs font-medium text-green-700 uppercase tracking-wide"
              >
                Store found
              </p>
              <div class="flex items-baseline justify-between">
                <span class="text-sm font-semibold text-gray-900"
                  >{looked.name}</span
                >
                <span class="text-xs font-mono text-gray-500"
                  >{looked.slug}</span
                >
              </div>
              <p class="text-xs text-gray-400 truncate">
                {looked.mcpServerUrl}
              </p>
            </div>
          {/if}
        </div>
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onclick={() => (showModal = false)}
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >Cancel</button
          >
          <button
            onclick={connectStore}
            disabled={lookupState !== "found"}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >Connect store</button
          >
        </div>
      {/if}
    </div>
  </div>
{/if}
