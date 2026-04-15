<script lang="ts">
  import { onMount } from "svelte";
  import { FileText, Pencil, RefreshCw, Trash2 } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { formatDate } from "$lib/utils/format.js";
  import type { Order } from "$lib/types/orders.js";

  let { order, onSaveBuyerNotes, slug } = $props<{ 
    order: Order, 
    onSaveBuyerNotes: (notes: string) => Promise<boolean>,
    slug: string
  }>();

  let editingNotes = $state(false);
  let editNotesVal = $state("");
  let savingNotes = $state(false);

  // ── Notes & Files State ────────────────────────────────────────
  let orderNotes = $state<any[]>([]);
  let loadingNotes = $state(false);
  let showDeletedNotes = $state(false);
  let newNoteText = $state("");
  let addingNote = $state(false);

  const token = () => localStorage.getItem("pc_token") ?? "";

  function startEditNotes() {
    editNotesVal = order?.notes ?? "";
    editingNotes = true;
  }

  async function saveNotes() {
    savingNotes = true;
    const ok = await onSaveBuyerNotes(editNotesVal);
    savingNotes = false;
    if (ok) editingNotes = false;
  }

  async function loadNotes() {
    loadingNotes = true;
    const res = await fetch(
      `/api/orders/${order.id}/notes?store=${slug}&show_deleted=${showDeletedNotes ? 1 : 0}`,
      {
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (res.ok) orderNotes = await res.json();
    loadingNotes = false;
  }

  async function addNote() {
    if (!newNoteText.trim()) return;
    addingNote = true;
    const res = await fetch(
      `/api/orders/${order.id}/notes?store=${slug}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ note: newNoteText }),
      },
    );
    if (res.ok) {
      newNoteText = "";
      await loadNotes();
    }
    addingNote = false;
  }

  async function deleteNote(noteId: number) {
    if (!confirm("Are you sure you want to delete this note?")) return;
    const res = await fetch(
      `/api/orders/${order.id}/notes/${noteId}?store=${slug}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (res.ok) await loadNotes();
  }

  onMount(() => {
    loadNotes();
  });
</script>

<div class="space-y-8">
  <!-- Delivery Instructions -->
  <Card class="p-0 overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
      <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
        Buyer Notes
      </h2>
      {#if !editingNotes}
        <Button onclick={startEditNotes} variant="secondary" size="sm" class="h-8 border-none bg-transparent group">
          <Pencil size={14} class="mr-1.5 text-indigo-600" />
          Edit
        </Button>
      {/if}
    </div>
    <div class="p-6">
      {#if editingNotes}
        <textarea
          bind:value={editNotesVal}
          rows="3"
          placeholder="Add special delivery instructions or buyer remarks…"
          class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all resize-none font-medium"
        ></textarea>
        <div class="flex justify-end gap-3 mt-4">
          <Button onclick={() => (editingNotes = false)} variant="secondary" size="sm">
            Cancel
          </Button>
          <Button onclick={saveNotes} disabled={savingNotes} variant="primary" size="sm">
            {#if savingNotes}
              <RefreshCw size={14} class="animate-spin mr-1" />
            {/if}
            Save Notes
          </Button>
        </div>
      {:else if order.notes}
        <div class="flex gap-3">
          <FileText size={18} class="text-gray-300 shrink-0 mt-0.5" />
          <p class="text-sm text-gray-700 font-medium leading-relaxed italic">
            "{order.notes}"
          </p>
        </div>
      {:else}
        <div class="flex flex-col items-center py-4 text-gray-400">
          <FileText size={24} class="opacity-20 mb-2" />
          <p class="text-[10px] font-black uppercase tracking-widest">No instructions provided</p>
        </div>
      {/if}
    </div>
  </Card>

  <!-- Internal Timeline -->
  <Card class="p-0 overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
      <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">
        Internal Timeline
      </h2>
      <label class="flex items-center gap-2 cursor-pointer group">
        <input
          type="checkbox"
          bind:checked={showDeletedNotes}
          onchange={loadNotes}
          class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
        />
        <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">Show Deleted</span>
      </label>
    </div>
    <div class="p-6">
      <div class="space-y-8 relative before:absolute before:left-3.75 before:top-2 before:bottom-2 before:w-px before:bg-gray-100">
        {#if loadingNotes && orderNotes.length === 0}
          <div class="flex items-center gap-4 py-2">
            <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center animate-spin">
              <RefreshCw size={14} class="text-gray-300" />
            </div>
            <p class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Loading history…</p>
          </div>
        {:else if orderNotes.length === 0}
          <div class="flex flex-col items-center py-8 text-gray-400">
            <FileText size={28} class="opacity-20 mb-3" />
            <p class="text-[10px] font-black uppercase tracking-widest">No notes in the timeline</p>
          </div>
        {:else}
          {#each orderNotes as note}
            <div class="relative flex gap-6 group {note.deleted_at ? 'opacity-40 grayscale' : ''}">
              <div class="shrink-0 w-8 h-8 rounded-full border-2 border-white bg-indigo-600 text-white flex items-center justify-center font-black text-[10px] shadow-sm z-10">
                {note.created_by[0].toUpperCase()}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-4 mb-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-gray-900 truncate">{note.created_by}</span>
                    <span class="text-[9px] font-bold text-gray-300 uppercase tracking-tight">{formatDate(note.created_at)}</span>
                  </div>
                  {#if !note.deleted_at}
                    <button onclick={() => deleteNote(note.id)} class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-50 rounded-lg">
                      <Trash2 size={12} />
                    </button>
                  {/if}
                </div>
                <p class="text-sm text-gray-600 font-medium leading-relaxed {note.deleted_at ? 'line-through decoration-2' : ''}">
                  {note.note}
                </p>
                {#if note.deleted_at}
                  <p class="mt-2 text-[8px] font-black uppercase tracking-[0.2em] text-red-400">
                    DELETED BY {note.deleted_by || 'Admin'} AT {formatDate(note.deleted_at)}
                  </p>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- New Note Box -->
      <div class="mt-10 pt-8 border-t border-gray-100">
        <textarea
          bind:value={newNoteText}
          rows="2"
          placeholder="Share an internal update or remark…"
          class="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all resize-none font-medium mb-3"
        ></textarea>
        <div class="flex justify-end">
          <Button onclick={addNote} disabled={addingNote || !newNoteText.trim()} variant="primary" size="sm" class="px-6">
            {#if addingNote}
              <RefreshCw size={14} class="animate-spin mr-1.5" />
            {/if}
            Share Note
          </Button>
        </div>
      </div>
    </div>
  </Card>
</div>
