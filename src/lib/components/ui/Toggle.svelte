<script lang="ts">
	import type { ToggleProps } from '$lib/types/ui.js';

	let {
		id,
		checked = $bindable(false),
		label = '',
		description = '',
		disabled = false,
		class: className = '',
		onchange = undefined,
		...rest
	}: ToggleProps = $props();

  function triggerChange(e: Event) {
    if (onchange) {
      onchange(e);
    }
  }
</script>

<label for={id} class="flex items-center gap-6 cursor-pointer p-6 rounded-2xl border border-gray-200 bg-gray-50/50 hover:bg-gray-100/50 transition-all group {disabled ? 'opacity-50 pointer-events-none' : ''} {className}">
  <div
    class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {checked
      ? 'bg-indigo-500'
      : 'bg-gray-700'}"
  >
    <input
      type="checkbox"
      {id}
      class="sr-only"
      bind:checked
      {disabled}
      onchange={triggerChange}
      {...rest}
    />
    <span
      class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out {checked
        ? 'translate-x-5'
        : 'translate-x-0'}"
    ></span>
  </div>
  <div class="flex flex-col gap-0.5">
    {#if label}
      <span class="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
        {label}
      </span>
    {/if}
    {#if description}
      <span class="text-xs text-gray-500 leading-tight">
        {description}
      </span>
    {/if}
  </div>
</label>
