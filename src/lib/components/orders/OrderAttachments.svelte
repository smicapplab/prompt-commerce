<script lang="ts">
  import { onMount } from "svelte";
  import { Clock, Download, Image as ImageIcon, Paperclip, Plus, RefreshCw, Trash2 } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import type { Order } from "$lib/types/orders.js";

  let { orderId, slug } = $props<{ 
    orderId: number, 
    slug: string
  }>();

  let orderFiles = $state<any[]>([]);
  let loadingFiles = $state(false);
  let showDeletedFiles = $state(false);
  let uploadingFile = $state(false);

  const token = () => localStorage.getItem("pc_token") ?? "";

  async function loadFiles() {
    loadingFiles = true;
    const res = await fetch(
      `/api/orders/${orderId}/files?store=${slug}&show_deleted=${showDeletedFiles ? 1 : 0}`,
      {
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (res.ok) orderFiles = await res.json();
    loadingFiles = false;
  }

  async function uploadFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;

    uploadingFile = true;
    const formData = new FormData();
    formData.append("file", input.files[0]);

    const res = await fetch(
      `/api/orders/${orderId}/files?store=${slug}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      },
    );
    if (res.ok) {
      await loadFiles();
    } else {
      const data = await res.json();
      alert(data.error || "Upload failed");
    }
    uploadingFile = false;
    input.value = ""; // Reset input
  }

  async function deleteFile(fileId: number) {
    if (!confirm("Are you sure you want to delete this file?")) return;
    const res = await fetch(
      `/api/orders/${orderId}/files/${fileId}?store=${slug}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (res.ok) await loadFiles();
  }

  onMount(() => {
    loadFiles();
  });
</script>

<Card class="p-0 overflow-hidden">
  <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
    <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
      File Attachments
    </h2>
    <label class="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        bind:checked={showDeletedFiles}
        onchange={loadFiles}
        class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
      />
      <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">Show Deleted</span>
    </label>
  </div>
  <div class="p-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {#each orderFiles as file}
        <div
          class="relative group p-4 border border-gray-100 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/40 transition-all shadow-sm flex flex-col {file.deleted_at ? 'opacity-40' : ''}"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
              {#if file.mime_type.startsWith("image/")}
                <ImageIcon size={20} />
              {:else}
                <Paperclip size={20} />
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-black text-gray-900 truncate group-hover:text-indigo-600 transition-colors {file.deleted_at ? 'line-through' : ''}" title={file.original_name}>
                {file.original_name}
              </p>
              <p class="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                {(file.size_bytes / 1024).toFixed(1)} KB • {file.uploaded_by}
              </p>
              <div class="flex items-center gap-4 mt-3">
                <a
                  href={file.file_url}
                  target="_blank"
                  class="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800"
                >
                  <Download size={12} />
                  Get File
                </a>
                {#if !file.deleted_at}
                  <button
                    onclick={() => deleteFile(file.id)}
                    class="inline-flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-700"
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}

      <label class="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/20 cursor-pointer transition-all group min-h-30">
        {#if uploadingFile}
          <RefreshCw size={24} class="text-indigo-600 animate-spin" />
          <span class="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Uploading…</span>
        {:else}
          <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
            <Plus size={24} />
          </div>
          <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600 transition-all">Upload Document</span>
        {/if}
        <input type="file" class="hidden" onchange={uploadFile} disabled={uploadingFile} />
      </label>
    </div>
    <div class="mt-6 flex items-center justify-center gap-2 p-3 bg-gray-50 rounded-xl">
      <Clock size={14} class="text-gray-400" />
      <p class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">MAX SIZE 20MB • PDF, XLSX, IMAGES</p>
    </div>
  </div>
</Card>
