<script lang="ts">
  import {
    Server,
    Globe,
    Link2,
    Check,
    RefreshCw,
    Info,
    ExternalLink,
    Lock,
    Shield,
  } from "@lucide/svelte";

  let { userRole, serverSettings, setServer, saving, saved, saveServer } =
    $props();
</script>

<div class="space-y-8 animate-in fade-in duration-500 pb-20">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900 tracking-tight">
      System Infrastructure
    </h2>
    <p class="text-sm text-gray-500 mt-1">
      Configure the core connectivity between the seller panel and the AI
      gateway.
    </p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Gateway Connectivity Card -->
    <div
      class="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
    >
      <div
        class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3"
      >
        <div
          class="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600"
        >
          <Globe size={20} />
        </div>
        <div>
          <h3 class="font-bold text-gray-900 leading-none">Gateway Endpoint</h3>
          <p
            class="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black"
          >
            Central Controller
          </p>
        </div>
      </div>

      <div class="p-6 space-y-4 flex-1">
        <div class="space-y-1.5 transition-all focus-within:text-indigo-600">
          <label
            for="g-url"
            class="text-[11px] font-black uppercase tracking-widest px-1"
            >Gateway URL</label
          >
          <div class="relative group">
            <Link2
              size={14}
              class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500"
            />
            <input
              id="g-url"
              type="text"
              disabled={userRole !== "super_admin"}
              value={serverSettings.gateway_url}
              oninput={(e) =>
                setServer("gateway_url", (e.target as HTMLInputElement).value)}
              placeholder="http://localhost:3002"
              class="w-full rounded-2xl border border-gray-100 bg-gray-50/30 pl-10 pr-4 py-3 text-sm font-mono focus:bg-white focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
            />
          </div>
          <p class="text-[10px] text-gray-400 leading-tight">
            Must match the base URL of your NestJS gateway instance.
          </p>
        </div>

        {#if userRole !== "super_admin"}
          <div
            class="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3"
          >
            <Lock size={16} class="text-amber-600 shrink-0 mt-0.5" />
            <p class="text-[10px] text-amber-700 font-medium leading-relaxed">
              Infrastructure settings are restricted to Super Administrators.
              Contact your system admin to change the gateway endpoint.
            </p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Public Access Card -->
    <div
      class="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
    >
      <div
        class="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3"
      >
        <div
          class="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600"
        >
          <ExternalLink size={20} />
        </div>
        <div>
          <h3 class="font-bold text-gray-900 leading-none">Public Presence</h3>
          <p
            class="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black"
          >
            Customer Facing
          </p>
        </div>
      </div>

      <div class="p-6 space-y-4 flex-1">
        <div class="space-y-1.5 transition-all focus-within:text-blue-600">
          <label
            for="p-url"
            class="text-[11px] font-black uppercase tracking-widest px-1"
            >Seller Public URL</label
          >
          <input
            id="p-url"
            type="text"
            disabled={userRole !== "super_admin"}
            value={serverSettings.seller_public_url}
            oninput={(e) =>
              setServer(
                "seller_public_url",
                (e.target as HTMLInputElement).value,
              )}
            placeholder="https://admin.yourstore.com"
            class="w-full rounded-2xl border border-gray-100 bg-gray-50/30 px-4 py-3 text-sm font-mono focus:bg-white focus:border-blue-500 outline-none transition-all disabled:opacity-50"
          />
          <p class="text-[10px] text-gray-400 leading-tight">
            Required for canonical image URLs and customer callbacks.
          </p>
        </div>

        <div
          class="mt-auto p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-start gap-3"
        >
          <Shield size={16} class="text-blue-600 shrink-0 mt-0.5" />
          <p
            class="text-[10px] text-blue-700 font-medium leading-relaxed italic"
          >
            Ensure your SSL certificates are valid for this domain to avoid
            mixed-content issues in Telegram or WhatsApp.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  {#if userRole === "super_admin"}
    <div
      class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-6 -mx-6 flex items-center justify-between z-10"
    >
      <button
        onclick={saveServer}
        disabled={saving}
        class="inline-flex items-center gap-3 rounded-2xl bg-gray-900 px-10 py-3.5 text-sm font-black text-white hover:bg-black active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-gray-100"
      >
        {#if saving}
          <RefreshCw size={18} class="animate-spin" /> Persisting Config
        {:else if saved === "server"}
          <Check size={18} /> Config Synchronized
        {:else}
          Update System Protocol
        {/if}
      </button>

      <div
        class="flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"
      >
        <span class="flex items-center gap-1.5"
          ><div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
           DB: SQLite/Registry</span
        >
        <span class="flex items-center gap-1.5"
          ><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
           Environment: Auto-Detected</span
        >
      </div>
    </div>
  {/if}
</div>
