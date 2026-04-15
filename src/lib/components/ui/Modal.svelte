<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { X } from '@lucide/svelte';
  import Card from './Card.svelte';
  import Button from './Button.svelte';

  interface Props {
    show: boolean;
    title?: string;
    description?: string;
    maxWidth?: string; // e.g. 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl'
    children?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
    onClose?: () => void;
  }

  let { 
    show = $bindable(false), 
    title, 
    description, 
    maxWidth = 'max-w-md',
    children,
    footer,
    onClose
  }: Props = $props();

  function handleClose() {
    show = false;
    onClose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && show) {
      handleClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
    onclick={handleClose}
  >
    <!-- Modal Content -->
    <div 
      class="w-full {maxWidth} relative"
      transition:scale={{ duration: 200, start: 0.95 }}
      onclick={(e) => e.stopPropagation()}
    >
      <Card class="shadow-2xl p-0 overflow-hidden border-none bg-white">
        <!-- Header -->
        <div class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div>
            {#if title}
              <h3 class="text-xl font-black text-gray-900 leading-none">{title}</h3>
            {/if}
            {#if description}
              <p class="text-xs text-gray-400 font-medium mt-2">{description}</p>
            {/if}
          </div>
          <Button onclick={handleClose} variant="secondary" size="sm" class="p-1 border-none bg-transparent h-auto text-gray-400 hover:text-gray-900 transition-colors">
            <X size={20} />
          </Button>
        </div>

        <!-- Body -->
        <div class="p-6">
          {@render children?.()}
        </div>

        <!-- Footer -->
        {#if footer}
          <div class="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
            {@render footer()}
          </div>
        {/if}
      </Card>
    </div>
  </div>
{/if}
