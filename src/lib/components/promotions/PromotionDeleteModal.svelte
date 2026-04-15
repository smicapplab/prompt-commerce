<script lang="ts">
  import { Trash2 } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";

  interface Props {
    deleteId: number | null;
    deleteTitle: string;
    onConfirm: () => Promise<void>;
  }

  let { deleteId = $bindable(), deleteTitle, onConfirm }: Props = $props();
</script>

{#if deleteId}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    onclick={(e) => e.target === e.currentTarget && (deleteId = null)}
    role="presentation"
  >
    <Card
      class="w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95 duration-200"
    >
      <div class="flex flex-col items-center text-center">
        <div
          class="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4"
        >
          <Trash2 size={24} />
        </div>
        <h2 class="text-lg font-black text-gray-900 mb-2">Delete Promotion?</h2>
        <p class="text-sm text-gray-500">
          The promotion "<span class="font-bold text-gray-900"
            >{deleteTitle}</span
          >" and its voucher code will be permanently removed.
        </p>
      </div>
      <div class="flex gap-3 mt-8">
        <Button
          onclick={() => (deleteId = null)}
          variant="secondary"
          class="flex-1"
        >
          Cancel
        </Button>
        <Button
          onclick={onConfirm}
          variant="primary"
          class="flex-1 bg-red-600 hover:bg-red-700"
        >
          Delete
        </Button>
      </div>
    </Card>
  </div>
{/if}
