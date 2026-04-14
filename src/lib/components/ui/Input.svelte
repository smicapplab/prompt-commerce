<script lang="ts">
  let { 
    id,
    type = "text",
    value = $bindable(""),
    placeholder = "",
    label = "",
    disabled = false,
    class: className = "",
    ...rest
  } = $props<{
    id?: string;
    type?: string;
    value?: string | number | undefined;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    class?: string;
    onkeydown?: (e: KeyboardEvent) => void;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
    [key: string]: any;
  }>();
</script>

<div class="flex flex-col gap-1.5 {className}">
  {#if label}
    <label for={id} class="text-[13px] font-bold text-gray-700 tracking-tight">
      {label}
    </label>
  {/if}
  <input
    {id}
    {type}
    bind:value
    {placeholder}
    {disabled}
    class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-400"
    {...rest}
  />
</div>
