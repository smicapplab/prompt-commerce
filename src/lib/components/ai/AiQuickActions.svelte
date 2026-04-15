<script lang="ts">
  import type { Component } from "svelte";

  interface QuickAction {
    icon: Component<any>;
    label: string;
    text: string;
  }

  interface Props {
    quickActions: QuickAction[];
    onSend: (text: string) => void;
  }

  let { quickActions, onSend }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-2 w-full max-w-md">
  {#each quickActions as qa}
    <button
      onclick={() => onSend(qa.text)}
      class="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-violet-300 hover:bg-violet-50 transition-colors flex items-center gap-2"
    >
      <qa.icon class="w-4 h-4 text-violet-500 shrink-0" />
      {qa.label}
    </button>
  {/each}
</div>
