<script lang="ts">
  import { 
    Check, 
    Eye, 
    EyeOff, 
    Sparkles, 
    Cpu, 
    Search, 
    Terminal, 
    Lock, 
    Key,
    Info,
    RefreshCw,
    ShieldCheck
  } from "@lucide/svelte";

  let { 
    activeStore,
    storeSettings, 
    val, 
    set, 
    saving, 
    saved, 
    aiGatewayStatus,
    aiGatewayReason,
    PROVIDER_MODELS,
    setProvider,
    customModelMode = $bindable(),
    claudeKeyInput = $bindable(),
    geminiKeyInput = $bindable(),
    openaiKeyInput = $bindable(),
    serperKeyInput = $bindable(),
    showClaudeKey = $bindable(),
    showGeminiKey = $bindable(),
    showOpenaiKey = $bindable(),
    showSerperKey = $bindable(),
    tempMcpKey,
    tempMcpExpiry,
    tempKeyLoading,
    tempKeyDuration = $bindable(),
    alerted,
    generateMcpKey,
    saveAi
  } = $props();
</script>

{#if !activeStore.slug}
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
      <Sparkles size={32} />
    </div>
    <h3 class="text-lg font-medium text-gray-900">No Store Selected</h3>
    <p class="text-sm text-gray-500 max-w-xs mt-1">AI settings are store-specific. Select a store to begin.</p>
  </div>
{:else}
  <div class="space-y-8 animate-in fade-in duration-500 pb-20">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 tracking-tight">AI & LLM Configuration</h2>
      <p class="text-sm text-gray-500 mt-1">Configure the brain behind your automated storefront.</p>
    </div>

    <!-- Provider & Model Selection -->
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="p-6 border-b border-gray-100 bg-gray-50/50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
            <Cpu size={20} />
          </div>
          <div>
            <h3 class="font-bold text-gray-900">Model Routing</h3>
            <p class="text-xs text-gray-500">Pick your preferred LLM and provider.</p>
          </div>
        </div>
      </div>

      <div class="p-6 space-y-6">
        <!-- Provider selection -->
        <div class="space-y-3">
          <label class="text-sm font-semibold text-gray-700 flex items-center gap-2">
            Active Provider
          </label>
          <div class="grid grid-cols-3 gap-3">
            {#each [["claude", "🤖 Claude", "purple"], ["gemini", "✨ Gemini", "blue"], ["openai", "⚫️ OpenAI", "gray"]] as [pid, label, color]}
              <button
                onclick={() => setProvider(pid)}
                class="flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all space-y-1
                  {val('ai_provider', 'claude') === pid
                  ? `border-${color}-600 bg-${color}-50/50 text-${color}-700`
                  : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'}"
              >
                <span class="text-sm font-bold">{label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Model Selection -->
        <div class="space-y-3">
          <label for="ai-model" class="text-sm font-semibold text-gray-700 flex items-center gap-2">
            Model Selection
          </label>
          <div class="relative">
            <select
              id="ai-model"
              value={customModelMode ? "__custom__" : val("ai_model")}
              onchange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (v === "__custom__") {
                  customModelMode = true;
                } else {
                  customModelMode = false;
                  set("ai_model", v);
                }
              }}
              class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm appearance-none focus:border-purple-500 focus:ring-4 focus:ring-purple-50/50 outline-none transition-all shadow-sm"
            >
              {#each PROVIDER_MODELS[val("ai_provider", "claude")] ?? PROVIDER_MODELS.claude as [v, label]}
                <option value={v}>{label}</option>
              {/each}
              <option value="__custom__">Custom Model...</option>
            </select>
            <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          {#if customModelMode}
            <div class="animate-in slide-in-from-top-2 duration-300">
               <input
                type="text"
                value={val("ai_model")}
                oninput={(e) => set("ai_model", (e.target as HTMLInputElement).value)}
                placeholder="e.g. claude-3-5-sonnet-latest"
                class="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-4 py-2.5 text-sm font-mono focus:border-purple-500 outline-none placeholder:text-purple-300"
              />
               <p class="mt-1 text-[10px] text-purple-600 font-medium">Use the provider's exact model ID string.</p>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- API Keys Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Keys Column -->
      <div class="space-y-6">
        <!-- Claude Key -->
        <div class="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 hover:shadow-sm transition-shadow">
          <div class="flex items-center justify-between">
             <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                   <Key size={16} />
                </div>
                <span class="text-sm font-bold text-gray-900">Anthropic Claude</span>
             </div>
             {#if storeSettings.claude_api_key_set}
               <span class="px-2 py-0.5 rounded-full bg-green-100 text-[10px] font-bold text-green-700 uppercase tracking-tight">Active</span>
             {/if}
          </div>
          <div class="relative">
             <input
                type={showClaudeKey ? "text" : "password"}
                bind:value={claudeKeyInput}
                placeholder={storeSettings.claude_api_key_set ? "••••••••••••••••" : "sk-ant-..."}
                class="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-2 text-xs font-mono focus:bg-white focus:border-orange-200 outline-none"
             />
             <button onclick={() => showClaudeKey = !showClaudeKey} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                {#if showClaudeKey}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
             </button>
          </div>
        </div>

        <!-- Gemini Key -->
        <div class="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 hover:shadow-sm transition-shadow">
          <div class="flex items-center justify-between">
             <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                   <Key size={16} />
                </div>
                <span class="text-sm font-bold text-gray-900">Google Gemini</span>
             </div>
             {#if storeSettings.gemini_api_key_set}
               <span class="px-2 py-0.5 rounded-full bg-green-100 text-[10px] font-bold text-green-700 uppercase tracking-tight">Active</span>
             {/if}
          </div>
          <div class="relative">
             <input
                type={showGeminiKey ? "text" : "password"}
                bind:value={geminiKeyInput}
                placeholder={storeSettings.gemini_api_key_set ? "••••••••••••••••" : "AIza..."}
                class="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-2 text-xs font-mono focus:bg-white focus:border-blue-200 outline-none"
             />
             <button onclick={() => showGeminiKey = !showGeminiKey} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                {#if showGeminiKey}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
             </button>
          </div>
        </div>

        <!-- Serper Key -->
        <div class="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 hover:shadow-sm transition-shadow">
          <div class="flex items-center justify-between">
             <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
                   <Search size={16} />
                </div>
                <span class="text-sm font-bold text-gray-900">Serper Search</span>
             </div>
             {#if storeSettings.serper_api_key_set}
               <span class="px-2 py-0.5 rounded-full bg-green-100 text-[10px] font-bold text-green-700 uppercase tracking-tight">Active</span>
             {/if}
          </div>
          <div class="relative">
             <input
                type={showSerperKey ? "text" : "password"}
                bind:value={serperKeyInput}
                placeholder={storeSettings.serper_api_key_set ? "••••••••••••••••" : "Search API Key..."}
                class="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-2 text-xs font-mono focus:bg-white focus:border-teal-200 outline-none"
             />
             <button onclick={() => showSerperKey = !showSerperKey} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                {#if showSerperKey}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
             </button>
          </div>
          <p class="text-[10px] text-gray-400">Used for real-time web search capabilities in chat.</p>
        </div>
      </div>

      <!-- System Prompt Column -->
      <div class="flex flex-col bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <label for="ai-prompt" class="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Terminal size={18} class="text-gray-400" />
          System Persona
        </label>
        <textarea
          id="ai-prompt"
          rows="12"
          value={val("ai_system_prompt")}
          oninput={(e) => set("ai_system_prompt", (e.target as HTMLTextAreaElement).value)}
          placeholder="e.g. You are a helpful sales assistant for 'Urban Threads', a minimalist clothing brand. You focus on helping customers find the right size and style..."
          class="flex-1 w-full rounded-xl border border-gray-200 bg-gray-50/30 p-4 text-sm focus:bg-white focus:border-purple-200 outline-none transition-all resize-none leading-relaxed"
        ></textarea>
        <p class="text-[11px] text-gray-400 leading-tight">
          Define how the AI should behave, what it knows about your brand, and any specific selling guidelines.
        </p>
      </div>
    </div>

    <!-- MCP Section -->
    <div class="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 border border-indigo-800">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-indigo-800 flex items-center justify-center text-indigo-400 border border-indigo-700">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h3 class="font-bold text-lg leading-none">LLM Client Access</h3>
          <p class="text-indigo-400 text-xs mt-1">Connect this store to external AI tools (Claude Desktop, etc.)</p>
        </div>
      </div>

      {#if tempMcpKey}
        <div class="space-y-4 p-4 rounded-xl bg-indigo-950/50 border border-indigo-700 animate-in zoom-in duration-300">
          <div class="relative">
            <input
              type="text"
              readonly
              value={tempMcpKey}
              class="w-full rounded-lg bg-indigo-900 border border-indigo-700 px-4 py-3 text-sm font-mono text-indigo-100 pr-12"
            />
            <button
              onclick={() => {
                navigator.clipboard.writeText(tempMcpKey);
                alerted = "Copied!";
                setTimeout(() => (alerted = ""), 2000);
              }}
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-indigo-400 hover:text-white"
            >
              <Check size={20} class={alerted ? "text-green-400" : ""} />
            </button>
          </div>
          <div class="flex items-center justify-between text-[11px] font-bold">
            <span class="text-indigo-400 uppercase tracking-widest">Expires: {new Date(tempMcpExpiry).toLocaleTimeString()}</span>
            {#if alerted}<span class="text-green-400">{alerted}</span>{/if}
          </div>
        </div>
      {:else}
        <div class="flex items-center gap-4">
          <div class="flex-1 space-y-1.5">
             <label class="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Duration</label>
             <select
                bind:value={tempKeyDuration}
                class="w-full rounded-xl bg-indigo-800 border border-indigo-700 px-4 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value={60}>1 Hour</option>
                <option value={240}>4 Hours</option>
                <option value={480}>8 Hours</option>
                <option value={1440}>24 Hours</option>
              </select>
          </div>
          <div class="flex-1 pt-5">
            <button
              onclick={generateMcpKey}
              disabled={tempKeyLoading}
              class="w-full h-[46px] rounded-xl bg-white text-indigo-900 font-black text-sm hover:bg-indigo-50 active:scale-95 transition-all shadow-lg"
            >
              {tempKeyLoading ? "Generating..." : "Generate Access Key"}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Actions Bar -->
    <div class="sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-gray-100 p-4 -mx-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          onclick={saveAi}
          disabled={saving}
          class="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-3 text-sm font-black text-white hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-100 active:scale-95"
        >
          {#if saving}
            <RefreshCw size={18} class="animate-spin" /> Saving...
          {:else if saved === "ai"}
            <Check size={18} /> Saved!
          {:else}
             Confirm AI Settings
          {/if}
        </button>

        <!-- Sync Status -->
        {#if aiGatewayStatus === "synced"}
          <div class="px-4 py-2 rounded-xl bg-green-50 text-green-700 border border-green-100 flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-left-4">
             <div class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
             <span class="text-[11px] font-black uppercase tracking-tight">Synced to Gateway</span>
          </div>
        {:else if aiGatewayStatus === "failed"}
          <div class="px-4 py-2 rounded-xl bg-red-50 text-red-700 border border-red-100 flex items-center gap-2">
             <div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
             <span class="text-[11px] font-black uppercase tracking-tight">Sync Failed: {aiGatewayReason}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
