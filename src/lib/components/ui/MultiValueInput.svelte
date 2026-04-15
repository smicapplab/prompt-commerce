<script lang="ts">
  import { X } from "@lucide/svelte";

  let { values = $bindable([]), placeholder = "Add...", onAdd }: { values: string[], placeholder?: string, onAdd?: (val: string) => void } = $props();
  let inputValue = $state("");

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addValue();
    } else if (e.key === "Backspace" && !inputValue && values.length > 0) {
      removeValue(values.length - 1);
    }
  }

  function addValue() {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      values = [...values, trimmed];
      if (onAdd) onAdd(trimmed);
    }
    inputValue = "";
  }

  function removeValue(index: number) {
    values = values.filter((_, i) => i !== index);
  }
</script>

<div class="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-white border border-indigo-100 rounded-xl min-h-[46px] focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all">
  {#each values as val, i}
    <span class="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 animate-in fade-in zoom-in duration-200">
      {val}
      <button 
        type="button" 
        onclick={() => removeValue(i)}
        class="hover:text-red-600 transition-colors"
      >
        <X size={10} strokeWidth={3} />
      </button>
    </span>
  {/each}
  <input
    type="text"
    bind:value={inputValue}
    onkeydown={handleKeyDown}
    onblur={addValue}
    {placeholder}
    class="flex-1 min-w-[80px] bg-transparent border-none outline-none text-sm placeholder:text-slate-300"
  />
</div>
