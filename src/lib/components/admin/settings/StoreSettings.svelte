<script lang="ts">
  import { 
    Check, 
    Store, 
    Coins, 
    Globe, 
    Truck, 
    RefreshCw, 
    Building2,
    CalendarDays,
    Navigation,
    Info,
    ArrowUpRight
  } from "@lucide/svelte";

  let { 
    activeStore,
    serverSettings,
    storeSettings, 
    val, 
    set, 
    saving, 
    saved, 
    saveStore 
  } = $props();
</script>

{#if !activeStore.slug}
  <div class="flex flex-col items-center justify-center py-20 text-center text-gray-400">
    <Store size={48} strokeWidth={1} />
    <p class="mt-4 text-sm font-medium">Select a store from the sidebar first.</p>
  </div>
{:else}
  <div class="space-y-10 animate-in fade-in duration-700">
    <!-- Header with Public Link -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 text-indigo-600 mb-1">
          <Building2 size={16} />
          <span class="text-[11px] font-black uppercase tracking-widest">Retailer Information</span>
        </div>
        <h2 class="text-3xl font-black text-gray-900 tracking-tight">{activeStore.name}</h2>
        <div class="flex items-center gap-3 mt-1">
           <span class="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-mono text-gray-500 uppercase tracking-tighter">SLUG: {activeStore.slug}</span>
           {#if serverSettings.gateway_url}
             <a
               href="{serverSettings.gateway_url.replace(/\/$/, '')}/stores/{activeStore.slug}"
               target="_blank"
               rel="noopener noreferrer"
               class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 decoration-2 underline-offset-4 hover:underline"
             >
               Visit Public Storefront <ArrowUpRight size={12} />
             </a>
           {/if}
        </div>
      </div>
    </div>

    <!-- Main Settings Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Display Name Card -->
      <div class="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all group">
        <div class="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
          <Navigation size={20} />
        </div>
        <div>
          <label for="s-name" class="block text-sm font-bold text-gray-900 mb-1">Display Name</label>
          <input
            id="s-name"
            type="text"
            value={val("store_display_name")}
            oninput={(e) => set("store_display_name", (e.target as HTMLInputElement).value)}
            placeholder="Official Store Name"
            class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-orange-500 outline-none transition-all"
          />
          <p class="mt-2 text-[11px] text-gray-500 leading-tight">Shown to buyers in messages and receipts.</p>
        </div>
      </div>

      <!-- Currency Card -->
      <div class="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all group">
        <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <Coins size={20} />
        </div>
        <div>
          <label for="s-currency" class="block text-sm font-bold text-gray-900 mb-1">Currency</label>
          <input
            id="s-currency"
            type="text"
            value={val("store_currency", "PHP")}
            oninput={(e) => set("store_currency", (e.target as HTMLInputElement).value)}
            placeholder="PHP"
            class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all uppercase"
          />
          <p class="mt-2 text-[11px] text-gray-500 leading-tight">ISO 4217 code (PHP, USD, etc.)</p>
        </div>
      </div>

      <!-- Timezone Card -->
      <div class="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all group">
        <div class="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
          <CalendarDays size={20} />
        </div>
        <div>
           <label for="s-tz" class="block text-sm font-bold text-gray-900 mb-1">Timezone</label>
           <input
             id="s-tz"
             type="text"
             value={val("store_timezone", "Asia/Manila")}
             oninput={(e) => set("store_timezone", (e.target as HTMLInputElement).value)}
             placeholder="Asia/Manila"
             class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-purple-500 outline-none transition-all"
           />
           <p class="mt-2 text-[11px] text-gray-500 leading-tight">Used for order timestamps.</p>
        </div>
      </div>
    </div>

    <!-- Fulfillment Section -->
    <div class="bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden">
       <!-- Decorative background element -->
       <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 blur-[100px] rounded-full"></div>

       <div class="relative z-10">
          <div class="flex items-center gap-3 mb-6">
             <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Truck size={24} />
             </div>
             <div>
                <h3 class="text-xl font-bold text-white leading-none">Fulfillment Options</h3>
                <p class="text-gray-500 text-sm mt-1">Configure how customers receive their orders.</p>
             </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
             <div class="space-y-4">
                <label class="flex items-center gap-6 cursor-pointer p-6 rounded-2xl border border-gray-800 bg-gray-800/30 hover:bg-gray-800/50 transition-all group">
                   <div class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {val('allows_pickup', '0') === '1' ? 'bg-indigo-500' : 'bg-gray-700'}">
                     <input 
                       type="checkbox" 
                       class="sr-only" 
                       checked={val('allows_pickup', '0') === '1'} 
                       onchange={(e) => set('allows_pickup', (e.target as HTMLInputElement).checked ? '1' : '0')}
                     />
                     <span class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out {val('allows_pickup', '0') === '1' ? 'translate-x-5' : 'translate-x-0'}"></span>
                   </div>
                   <div class="flex flex-col">
                      <span class="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">Store Pickup</span>
                      <span class="text-xs text-gray-500 leading-tight">Let buyers collect orders directly from your physical location.</span>
                   </div>
                </label>
             </div>

             <div class="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                <Info size={18} class="text-indigo-400 shrink-0 mt-0.5" />
                <p class="text-xs text-gray-500 leading-relaxed italic">
                   Note: Delivery fees and zones are configured separately in the <b>Shipping Matrix</b> (Coming soon). Standard delivery is enabled by default.
                </p>
             </div>
          </div>
       </div>
    </div>

    <!-- Fixed Bottom Actions -->
    <div class="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-gray-100 p-6 -mx-6 flex items-center justify-between z-20">
      <div class="flex items-center gap-4">
        <button
          onclick={saveStore}
          disabled={saving}
          class="inline-flex items-center gap-3 rounded-2xl bg-gray-900 px-10 py-3.5 text-base font-black text-white hover:bg-black active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-gray-200"
        >
          {#if saving}
            <RefreshCw size={20} class="animate-spin" /> Saving Changes
          {:else if saved === "store"}
            <Check size={20} class="text-green-400" /> Changes Saved
          {:else}
             Commit Global Settings
          {/if}
        </button>
      </div>

      {#if saved === "store"}
        <div class="flex items-center gap-2 px-4 py-2 border border-green-100 bg-green-50 rounded-xl text-green-700 animate-in fade-in slide-in-from-right-4">
           <Check size={16} />
           <span class="text-xs font-black uppercase tracking-tight">System Updated Successfully</span>
        </div>
      {/if}
    </div>
  </div>
{/if}
