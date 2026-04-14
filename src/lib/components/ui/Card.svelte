<script lang="ts">
  let { 
    class: className = "",
    children, 
    ...rest 
  } = $props<{
    class?: string;
    children?: any;
    [key: string]: any;
  }>();
</script>

<div class="bg-white rounded-2xl border border-gray-100 shadow-sm {className}" {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
