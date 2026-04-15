<script lang="ts">
  interface Props {
    columns: number;
    rows?: number;
  }

  let { columns = 5, rows = 5 }: Props = $props();
</script>

<div class="w-full space-y-4 animate-pulse">
  {#each Array(rows) as _}
    <div class="flex items-center space-x-4 py-4 px-6 border-b border-gray-50 last:border-0">
      {#each Array(columns) as _, i}
        <div class="flex-1">
          <div class="h-4 bg-gray-100 rounded-lg {i === 0 ? 'w-12' : i === 1 ? 'w-3/4' : 'w-1/2'}"></div>
          {#if i === 1}
            <div class="h-2 bg-gray-50 rounded-lg w-1/4 mt-2"></div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>
