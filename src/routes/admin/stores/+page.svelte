<script lang="ts">
  import {
    Plus,
    Pencil,
    Trash2,
    Copy,
    Check,
    Store,
    Search,
    RefreshCw,
    ChevronLeft,
    ShieldAlert,
    X,
    Info,
    CircleCheck,
  } from "@lucide/svelte";

  import type { StoreItem } from "$lib/types/stores.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import { goto } from "$app/navigation";

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
        mcp_server_url: looked.mcpServerUrl,
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

<svelte:head>
  <title>Manage Stores — Prompt Commerce</title>
</svelte:head>

<!-- Toast -->
{#if toast}
  <div
    class="fixed top-6 right-6 z-110 px-6 py-4 rounded-2xl text-sm font-black shadow-2xl animate-in slide-in-from-right-10
    {toastType === 'success'
      ? 'bg-emerald-600 text-white'
      : 'bg-red-600 text-white'}"
  >
    <div class="flex items-center gap-3">
      {#if toastType === "success"}
        <CircleCheck size={18} />
      {:else}
        <ShieldAlert size={18} />
      {/if}
      <span class="uppercase tracking-widest">{toast}</span>
    </div>
  </div>
{/if}

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto">
  <!-- Header -->
  <div
    class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10"
  >
    <div class="flex items-center gap-6">
      <Button
        variant="secondary"
        size="sm"
        onclick={() => goto("/admin")}
        class="h-10 w-10 p-0 rounded-2xl shadow-none border-gray-100"
      >
        <ChevronLeft size={20} />
      </Button>
      <div>
        <h1
          class="text-3xl font-black text-gray-900 tracking-tight leading-none mb-1"
        >
          Store Registries
        </h1>
        <p
          class="text-[10px] font-black uppercase tracking-widest text-gray-400"
        >
          Configure external platform connections
        </p>
      </div>
    </div>
    <Button
      variant="primary"
      onclick={openCreate}
      class="bg-gray-900 border-none hover:bg-black shadow-xl shadow-gray-200"
    >
      <Plus size={18} class="mr-2" /> Connect Platform
    </Button>
  </div>

  {#if loading}
    <div class="py-24 text-center">
      <RefreshCw size={32} class="animate-spin text-indigo-600 mx-auto mb-4" />
      <p
        class="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse"
      >
        Syncing store records...
      </p>
    </div>
  {:else if stores.length === 0}
    <div class="py-24 text-center">
      <div
        class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300"
      >
        <Store size={32} />
      </div>
      <h2
        class="text-xl font-black text-gray-900 uppercase tracking-tight mb-2"
      >
        Registry Empty
      </h2>
      <p class="text-sm font-medium text-gray-400">
        Connect your first store to begin managing inventory and orders.
      </p>
    </div>
  {:else}
    <Card class="p-0 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-gray-50/50">
              <th
                class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"
                >Store Entity</th
              >
              <th
                class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"
                >Platform Identity</th
              >
              <th
                class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"
                >Security Token</th
              >
              <th
                class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"
                >Access State</th
              >
              <th class="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each stores as s}
              <tr class="group hover:bg-gray-50/20 transition-colors">
                <td class="px-6 py-6 whitespace-nowrap">
                  <div class="flex items-center gap-4">
                    <div
                      class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm shadow-sm group-hover:scale-105 transition-transform"
                    >
                      {s.name[0].toUpperCase()}
                    </div>
                    <span class="text-sm font-black text-gray-900"
                      >{s.name}</span
                    >
                  </div>
                </td>
                <td class="px-6 py-6 whitespace-nowrap">
                  <span
                    class="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono bg-gray-50 px-2 py-1 rounded-lg border border-gray-100"
                    >{s.slug}</span
                  >
                </td>
                <td class="px-6 py-6 whitespace-nowrap">
                  {#if s.gateway_key}
                    <div class="flex items-center gap-2 group/key">
                      <span
                        class="font-mono text-[10px] text-gray-400 font-bold bg-white px-2 py-1 rounded-lg border border-gray-100"
                        >{s.gateway_key.slice(0, 12)}••••</span
                      >
                      <button
                        onclick={() => copyKey(s)}
                        class="text-gray-300 hover:text-indigo-600 transition-all opacity-0 group-hover/key:opacity-100"
                      >
                        {#if copiedKey === s.id}<Check
                            size={14}
                            class="text-emerald-500"
                          />{:else}<Copy size={14} />{/if}
                      </button>
                    </div>
                  {:else}
                    <Badge
                      variant="secondary"
                      class="bg-gray-50 text-gray-300 border-none font-bold text-[9px] uppercase tracking-tighter italic"
                      >Not Assigned</Badge
                    >
                  {/if}
                </td>
                <td class="px-6 py-6 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <Toggle
                      checked={!!s.active}
                      onchange={() => toggleActive(s)}
                      size="sm"
                    />
                    <span
                      class="text-[10px] font-black uppercase tracking-widest {s.active
                        ? 'text-emerald-600'
                        : 'text-gray-300'}"
                    >
                      {s.active ? "Active" : "Offline"}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-6 whitespace-nowrap text-right">
                  <div
                    class="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      onclick={() => openEdit(s)}
                      class="h-8 w-8 p-0 border-none hover:bg-indigo-50 hover:text-indigo-600 shadow-none"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onclick={() => deleteStore(s)}
                      class="h-8 w-8 p-0 border-none hover:bg-red-50 hover:text-red-600 shadow-none"
                    >
                      <Trash2 size={14} />
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

<!-- Unified Modal -->
{#if showModal}
  <div class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onclick={() => (showModal = false)}
      role="presentation"
    ></div>

    <Card
      class="w-full max-w-md shadow-2xl p-8 animate-in zoom-in-95 duration-200 z-10"
    >
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-900"
          >
            {#if editTarget}<Pencil size={24} />{:else}<Store size={24} />{/if}
          </div>
          <div>
            <h3 class="text-xl font-black text-gray-900 leading-none">
              {editTarget ? "Edit Store" : "Connect Store"}
            </h3>
            <p class="text-xs text-gray-400 font-medium mt-1">
              {editTarget
                ? `Modify registry for ${editTarget.name}`
                : "Link a new external storefront key"}
            </p>
          </div>
        </div>
        <button
          onclick={() => (showModal = false)}
          class="text-gray-300 hover:text-gray-900 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {#if editTarget}
        <!-- Edit Form -->
        <div class="space-y-6">
          <Input
            id="edit-name"
            label="Store Identity"
            bind:value={form.name}
            placeholder="Official Name"
          />
          <Input
            id="edit-slug"
            label="Identifier (Slug)"
            bind:value={form.slug}
            placeholder="store-slug"
            class="font-mono text-xs"
          />
          <div class="space-y-2">
            <label
              for="edit-desc"
              class="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
              >Internal Description</label
            >
            <textarea
              id="edit-desc"
              bind:value={form.description}
              rows="2"
              class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-sm focus:bg-white focus:border-indigo-200 outline-none transition-all resize-none"
            ></textarea>
          </div>
          <Input
            id="edit-key"
            label="Permanent Platform Key"
            bind:value={form.gateway_key}
            class="font-mono text-xs"
          />

          <div class="flex flex-col gap-3 pt-4">
            <Button
              variant="primary"
              onclick={saveStore}
              disabled={!form.slug || !form.name}
              class="w-full h-12 bg-gray-900 border-none hover:bg-black font-black uppercase text-xs tracking-widest shadow-xl"
            >
              Apply Global Changes
            </Button>
            <Button
              variant="secondary"
              onclick={() => (showModal = false)}
              class="w-full h-12 border-none bg-gray-100 text-gray-500 hover:bg-gray-200 font-black uppercase text-xs tracking-widest"
              >Cancel</Button
            >
          </div>
        </div>
      {:else}
        <!-- Connect Flow -->
        <div class="space-y-8">
          <div class="space-y-4">
            <label
              for="add-key"
              class="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
              >Platform Secret Key</label
            >
            <div class="flex gap-3">
              <Input
                id="add-key"
                bind:value={keyInput}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter") lookupKey();
                }}
                placeholder="gk_••••••••••••"
                class="flex-1 font-mono text-xs"
              />
              <Button
                variant="secondary"
                onclick={lookupKey}
                disabled={!keyInput.trim() || lookupState === "loading"}
                class="h-11 px-4 border-gray-100"
              >
                {#if lookupState === "loading"}
                  <RefreshCw size={16} class="animate-spin" />
                {:else}
                  <Search size={16} />
                {/if}
              </Button>
            </div>
            <p class="text-[10px] text-gray-400 font-medium px-1 italic">
              Use the unique key provided by the commerce gateway.
            </p>
          </div>

          {#if lookupState === "error"}
            <div
              class="rounded-2xl bg-red-50 border border-red-100 p-4 flex items-start gap-3 text-red-700 animate-in shake-in-1"
            >
              <ShieldAlert size={18} class="shrink-0 mt-0.5" />
              <p class="text-xs font-bold leading-relaxed">{lookupError}</p>
            </div>
          {/if}

          {#if lookupState === "found" && looked}
            <div
              class="rounded-3xl bg-indigo-50 border border-indigo-100 p-6 space-y-4 animate-in zoom-in-95"
            >
              <div class="flex items-center gap-2">
                <CircleCheck size={16} class="text-indigo-600" />
                <span
                  class="text-[10px] font-black text-indigo-600 uppercase tracking-widest"
                  >Valid Entity Identified</span
                >
              </div>
              <div>
                <h4 class="text-lg font-black text-gray-900 leading-tight mb-1">
                  {looked.name}
                </h4>
                <div class="flex items-center justify-between">
                  <span
                    class="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono italic"
                    >@{looked.slug}</span
                  >
                </div>
              </div>
              <div
                class="pt-3 border-t border-indigo-100 flex items-center gap-2 text-indigo-500 overflow-hidden"
              >
                <Info size={12} class="shrink-0" />
                <span class="text-[9px] font-mono truncate"
                  >{looked.mcpServerUrl}</span
                >
              </div>
            </div>
          {/if}

          <div class="flex flex-col gap-3 pt-4">
            <Button
              variant="primary"
              onclick={connectStore}
              disabled={lookupState !== "found"}
              class="w-full h-12 bg-indigo-600 border-none hover:bg-indigo-700 font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100"
            >
              Initialize Connection
            </Button>
            <Button
              variant="secondary"
              onclick={() => (showModal = false)}
              class="w-full h-12 border-none bg-gray-100 text-gray-500 hover:bg-gray-200 font-black uppercase text-xs tracking-widest"
              >Discard</Button
            >
          </div>
        </div>
      {/if}
    </Card>
  </div>
{/if}
