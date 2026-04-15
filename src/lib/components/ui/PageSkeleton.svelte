<script lang="ts">
  import Card from './Card.svelte';
</script>

<div class="px-6 py-6 max-w-6xl mx-auto space-y-8 animate-pulse">
  <!-- Header Skeleton -->
  <div class="flex items-start justify-between">
    <div class="space-y-3">
      <div class="h-8 bg-gray-200 rounded-xl w-48"></div>
      <div class="h-4 bg-gray-100 rounded-lg w-64"></div>
    </div>
    <div class="h-10 bg-gray-100 rounded-2xl w-32"></div>
  </div>

  <!-- Content Skeleton -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div class="lg:col-span-2 space-y-6">
      <Card class="p-0 overflow-hidden min-h-[400px]">
        <div class="p-6 border-b border-gray-50 flex justify-between">
          <div class="h-6 bg-gray-100 rounded-lg w-32"></div>
          <div class="h-6 bg-gray-100 rounded-lg w-20"></div>
        </div>
        <div class="p-8 space-y-6">
          {#each Array(4) as _}
            <div class="space-y-2">
              <div class="h-4 bg-gray-100 rounded-lg w-1/4"></div>
              <div class="h-10 bg-gray-50 rounded-xl w-full"></div>
            </div>
          {/each}
        </div>
      </Card>
    </div>

    <div class="space-y-6">
      <Card class="p-6 space-y-4">
        <div class="h-6 bg-gray-100 rounded-lg w-1/2"></div>
        <div class="space-y-3 pt-2">
          <div class="h-4 bg-gray-50 rounded-lg w-full"></div>
          <div class="h-4 bg-gray-50 rounded-lg w-3/4"></div>
          <div class="h-4 bg-gray-50 rounded-lg w-5/6"></div>
        </div>
      </Card>

      <Card class="p-6 space-y-4">
        <div class="h-6 bg-gray-100 rounded-lg w-1/2"></div>
        <div class="flex gap-2">
          <div class="h-8 bg-gray-50 rounded-full w-24"></div>
          <div class="h-8 bg-gray-50 rounded-full w-24"></div>
        </div>
      </Card>
    </div>
  </div>
</div>
