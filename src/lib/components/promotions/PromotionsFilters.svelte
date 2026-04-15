<script lang="ts">
  import { Search } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Button from "$lib/components/ui/Button.svelte";

  interface Props {
    q: string;
    filterActive: string;
    onSearch: () => void;
  }

  let { q = $bindable(), filterActive = $bindable(), onSearch }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      onSearch();
    }
  }
</script>

<Card class="p-4 mb-6">
  <div class="flex flex-col md:flex-row gap-4">
    <div class="flex-1 relative">
      <Search
        size={18}
        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <Input
        type="search"
        placeholder="Search title or code…"
        bind:value={q}
        onkeydown={handleKeydown}
        class="pl-10"
      />
    </div>
    <div class="flex gap-4">
      <Select
        bind:value={filterActive}
        onchange={onSearch}
        class="w-40"
        options={[
          { value: "", label: "All Status" },
          { value: "1", label: "Active" },
          { value: "0", label: "Inactive" },
        ]}
      />
      <Button onclick={onSearch} variant="secondary">Search</Button>
    </div>
  </div>
</Card>
