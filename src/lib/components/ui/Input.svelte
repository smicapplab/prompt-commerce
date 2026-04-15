<script lang="ts">
	import type { InputProps } from '$lib/types/ui.js';

	let {
		id,
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		label = '',
		disabled = false,
		class: className = '',
		left,
		right,
		labelExtra,
		...rest
	}: InputProps = $props();
</script>

<div class="flex flex-col gap-1.5 {className}">
	{#if label || labelExtra}
		<label for={id} class="text-[13px] font-bold text-gray-700 tracking-tight flex items-center">
			{label}
			{#if labelExtra}
				{@render labelExtra()}
			{/if}
		</label>
	{/if}
	<div class="relative group">
		{#if left}
			<div class="absolute left-3 inset-y-0 flex items-center pointer-events-none text-gray-400">
				{@render left()}
			</div>
		{/if}
		<input
			{id}
			{type}
			bind:value
			{placeholder}
			{disabled}
			class="w-full rounded-xl border border-gray-200 bg-white {left ? 'pl-10' : 'px-4'} {right ? 'pr-10' : 'px-4'} py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-400"
			{...rest}
		/>
		{#if right}
			<div class="absolute right-3 inset-y-0 flex items-center">
				{@render right()}
			</div>
		{/if}
	</div>
</div>
