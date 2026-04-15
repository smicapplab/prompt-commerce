<script lang="ts">
	import type { SelectProps } from '$lib/types/ui.js';

	let {
		id,
		value = $bindable(''),
		label = '',
		disabled = false,
		options = [],
		class: className = '',
		...rest
	}: SelectProps = $props();
</script>

<div class="flex flex-col gap-1.5 {className}">
  {#if label}
    <label for={id} class="text-[13px] font-bold text-gray-700 tracking-tight">
      {label}
    </label>
  {/if}
  <div class="relative">
    <select
      {id}
      bind:value
      {disabled}
      class="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:bg-gray-50 bg-none"
      {...rest}
    >
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
</div>
