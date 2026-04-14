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
    ShieldCheck,
    AlertCircle,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import { fade } from "svelte/transition";

  // Internal state
  let data = $state<Record<string, string | boolean>>({});
  let loading = $state(false);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state("");

  // Input states for keys (masked by server)
  let claudeKeyInput = $state("");
  let geminiKeyInput = $state("");
  let openaiKeyInput = $state("");
  let serperKeyInput = $state("");

  // Visibility toggles
  let showClaudeKey = $state(false);
  let showGeminiKey = $state(false);
  let showOpenaiKey = $state(false);
  let showSerperKey = $state(false);

  // Sync status
  let aiGatewayStatus = $state<"idle" | "checking" | "synced" | "failed">("idle");
  let aiGatewayReason = $state("");

  // Temp MCP Key
  let tempMcpKey = $state("");
  let tempMcpExpiry = $state("");
  let tempKeyLoading = $state(false);
  let tempKeyDuration = $state(60);
  let alerted = $state("");

  let customModelMode = $state(false);

  const PROVIDER_MODELS: Record<string, Array<[string, string]>> = {
    claude: [
      ["", "Default (claude-sonnet-4-5)"],
      ["claude-opus-4-5", "claude-opus-4-5 — Most capable"],
      ["claude-haiku-4-5", "claude-haiku-4-5 — Fast"],
    ],
    gemini: [
      ["", "Default (gemini-2.0-flash)"],
      ["gemini-2.0-flash", "gemini-2.0-flash"],
      ["gemini-1.5-pro", "gemini-1.5-pro"],
      ["gemini-1.5-flash", "gemini-1.5-flash"],
    ],
    openai: [
      ["", "Default (gpt-4o-mini)"],
      ["gpt-4o", "gpt-4o"],
      ["gpt-4o-mini", "gpt-4o-mini — Fast"],
      ["o1", "o1"],
    ],
  };

  const token = () => localStorage.getItem("pc_token") ?? "";

  function val(key: string, fallback = ""): string {
    return String(data[key] ?? fallback);
  }

  $effect(() => {
    if (activeStore.slug) load();
  });

  async function load() {
    if (!activeStore.slug) return;
    loading = true;
    error = "";
    try {
      const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        data = await res.json();
        const prov = val("ai_provider", "claude");
        const model = val("ai_model");
        if (model && !(PROVIDER_MODELS[prov] ?? []).some(m => m[0] === model)) {
          customModelMode = true;
        } else {
          customModelMode = false;
        }
      }
    } catch (e) {
      error = "Load failed";
    } finally {
      loading = false;
    }
  }

  function setProvider(pid: string) {
    data.ai_provider = pid;
    data.ai_model = "";
    customModelMode = false;
  }

  async function saveAi() {
    if (!activeStore.slug) return;
    saving = true;
    saved = false;
    error = "";
    
    const payload: Record<string, string> = {
      ai_enabled: val("ai_enabled", "0"),
      ai_provider: val("ai_provider", "claude"),
      ai_model: val("ai_model"),
      ai_system_prompt: val("ai_system_prompt"),
    };
    if (claudeKeyInput) payload.claude_api_key = claudeKeyInput.trim();
    if (geminiKeyInput) payload.gemini_api_key = geminiKeyInput.trim();
    if (openaiKeyInput) payload.openai_api_key = openaiKeyInput.trim();
    if (serperKeyInput) payload.serper_api_key = serperKeyInput.trim();

    try {
      const res = await fetch(`/api/settings?store=${activeStore.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        data = await res.json();
        claudeKeyInput = geminiKeyInput = openaiKeyInput = serperKeyInput = "";
        saved = true;
        aiGatewayStatus = "checking";
        
        setTimeout(async () => {
          try {
            const gwRes = await fetch(`/api/settings/ai-sync-status?store=${activeStore.slug}`, {
              headers: { Authorization: `Bearer ${token()}` }
            });
            if (gwRes.ok) {
              const { synced, reason } = await gwRes.json();
              aiGatewayStatus = synced ? "synced" : "failed";
              aiGatewayReason = reason ?? "";
            } else { aiGatewayStatus = "failed"; }
          } catch { aiGatewayStatus = "failed"; }
        }, 1500);
        
        setTimeout(() => (saved = false), 3000);
      } else {
        const d = await res.json();
        error = d.error ?? "Save failed";
      }
    } catch (e) {
      error = "Connection error";
    } finally {
      saving = false;
    }
  }

  async function generateMcpKey() {
    tempKeyLoading = true;
    error = "";
    try {
      const res = await fetch("/api/auth/temp-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ expiresIn: tempKeyDuration }),
      });
      if (res.ok) {
        const d = await res.json();
        tempMcpKey = d.token;
        tempMcpExpiry = d.expiresAt;
      } else {
        const d = await res.json();
        error = d.error ?? "Failed to generate key";
      }
    } catch { error = "Network error"; }
    finally { tempKeyLoading = false; }
  }
</script>

{#if !activeStore.slug}
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
      <Sparkles size={32} />
    </div>
    <h3 class="text-lg font-medium text-gray-900">No Store Selected</h3>
    <p class="text-sm text-gray-500 max-w-xs mt-1">AI settings are store-specific. Select a store to begin.</p>
  </div>
{:else if loading && !data.ai_provider}
  <div class="flex items-center justify-center py-20">
    <RefreshCw size={32} class="animate-spin text-gray-300" />
  </div>
{:else}
  <div class="space-y-8 animate-in fade-in duration-500 pb-20">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 tracking-tight">AI & LLM Configuration</h2>
      <p class="text-sm text-gray-500 mt-1">Configure the brain behind your automated storefront.</p>
    </div>

    {#if error}
      <div class="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700">
        <AlertCircle size={18} />
        <p class="text-sm font-bold">{error}</p>
      </div>
    {/if}

    <!-- Provider & Model Selection -->
    <Card class="overflow-hidden">
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
        <!-- AI Enabled Toggle -->
        <Toggle
          checked={val("ai_enabled", "0") === "1"}
          onchange={(e) => data.ai_enabled = (e.target as HTMLInputElement).checked ? "1" : "0"}
          label="AI Assistant Status"
          description={val("ai_enabled", "0") === "1" ? "Active" : "Disabled"}
          class="bg-purple-50 border-purple-100"
        />

        <!-- Provider selection -->
        <div class="space-y-3">
          <div class="text-sm font-semibold text-gray-700 flex items-center gap-2">Active Provider</div>
          <div class="grid grid-cols-3 gap-3">
            {#each [["claude", "Claude", "purple"], ["gemini", "Gemini", "blue"], ["openai", "OpenAI", "gray"]] as [pid, label, color]}
              <Button
                variant={val("ai_provider", "claude") === pid ? "primary" : "secondary"}
                onclick={() => setProvider(pid)}
                class="flex-col h-auto p-3 {val("ai_provider", "claude") === pid ? `bg-${color}-600 border-${color}-600 shadow-${color}-100` : ''}"
              >
                <span class="text-sm font-bold">{label}</span>
              </Button>
            {/each}
          </div>
        </div>

        <!-- Model Selection -->
        <div class="space-y-3">
          <Select
            id="ai-model"
            label="Model Selection"
            value={customModelMode ? "__custom__" : val("ai_model")}
            onchange={(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              if (v === "__custom__") {
                customModelMode = true;
              } else {
                customModelMode = false;
                data.ai_model = v;
              }
            }}
            options={[
              ...(PROVIDER_MODELS[val("ai_provider", "claude")] ?? PROVIDER_MODELS.claude).map(([v, l]: [string, string]) => ({ value: v, label: l })),
              { value: "__custom__", label: "Custom Model..." }
            ]}
          />

          {#if customModelMode}
            <div class="animate-in slide-in-from-top-2 duration-300">
              <Input
                value={val("ai_model")}
                oninput={(e: Event) => data.ai_model = (e.target as HTMLInputElement).value}
                placeholder="e.g. claude-3-5-sonnet-latest"
                class="font-mono"
              />
              <p class="mt-1 text-[10px] text-purple-600 font-medium ml-1">Use the provider's exact model ID string.</p>
            </div>
          {/if}
        </div>
      </div>
    </Card>

    <!-- API Keys Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Keys Column -->
      <div class="space-y-6">
        <!-- Claude Key -->
        <Card class="p-5 space-y-4 hover:shadow-sm transition-shadow">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                <Key size={16} />
              </div>
              <span class="text-sm font-bold text-gray-900">Anthropic Claude</span>
            </div>
            {#if data.claude_api_key_set}
              <Badge class="bg-green-100 text-green-700 border-green-200">Active</Badge>
            {/if}
          </div>
          <div class="relative">
            <Input
              type={showClaudeKey ? "text" : "password"}
              bind:value={claudeKeyInput}
              placeholder={data.claude_api_key_set ? "••••••••••••••••" : "sk-ant-..."}
              class="font-mono text-xs"
            />
            <button
              onclick={() => (showClaudeKey = !showClaudeKey)}
              class="absolute right-3 top-[34px] -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              {#if showClaudeKey}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
            </button>
          </div>
        </Card>

        <!-- Gemini Key -->
        <Card class="p-5 space-y-4 hover:shadow-sm transition-shadow">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <Key size={16} />
              </div>
              <span class="text-sm font-bold text-gray-900">Google Gemini</span>
            </div>
            {#if data.gemini_api_key_set}
              <Badge class="bg-green-100 text-green-700 border-green-200">Active</Badge>
            {/if}
          </div>
          <div class="relative">
            <Input
              type={showGeminiKey ? "text" : "password"}
              bind:value={geminiKeyInput}
              placeholder={data.gemini_api_key_set ? "••••••••••••••••" : "AIza..."}
              class="font-mono text-xs"
            />
            <button
              onclick={() => (showGeminiKey = !showGeminiKey)}
              class="absolute right-3 top-[34px] -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              {#if showGeminiKey}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
            </button>
          </div>
        </Card>

        <!-- OpenAI Key -->
        <Card class="p-5 space-y-4 hover:shadow-sm transition-shadow">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <Key size={16} />
              </div>
              <span class="text-sm font-bold text-gray-900">OpenAI</span>
            </div>
            {#if data.openai_api_key_set}
              <Badge class="bg-green-100 text-green-700 border-green-200">Active</Badge>
            {/if}
          </div>
          <div class="relative">
            <Input
              type={showOpenaiKey ? "text" : "password"}
              bind:value={openaiKeyInput}
              placeholder={data.openai_api_key_set ? "••••••••••••••••" : "sk-..."}
              class="font-mono text-xs"
            />
            <button
              onclick={() => (showOpenaiKey = !showOpenaiKey)}
              class="absolute right-3 top-[34px] -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              {#if showOpenaiKey}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
            </button>
          </div>
        </Card>

        <!-- Serper Key -->
        <Card class="p-5 space-y-4 hover:shadow-sm transition-shadow">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
                <Search size={16} />
              </div>
              <span class="text-sm font-bold text-gray-900">Serper Search</span>
            </div>
            {#if data.serper_api_key_set}
              <Badge class="bg-green-100 text-green-700 border-green-200">Active</Badge>
            {/if}
          </div>
          <div class="relative">
            <Input
              type={showSerperKey ? "text" : "password"}
              bind:value={serperKeyInput}
              placeholder={data.serper_api_key_set ? "••••••••••••••••" : "Search API Key..."}
              class="font-mono text-xs"
            />
            <button
              onclick={() => (showSerperKey = !showSerperKey)}
              class="absolute right-3 top-[34px] -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              {#if showSerperKey}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
            </button>
          </div>
          <p class="text-[10px] text-gray-400">Used for real-time web search capabilities in chat.</p>
        </Card>
      </div>

      <!-- System Prompt Column -->
      <Card class="p-6 space-y-4">
        <label for="ai-prompt" class="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Terminal size={18} class="text-gray-400" />
          System Persona
        </label>
        <textarea
          id="ai-prompt"
          rows="12"
          value={val("ai_system_prompt")}
          oninput={(e: Event) => data.ai_system_prompt = (e.target as HTMLTextAreaElement).value}
          placeholder="e.g. You are a helpful sales assistant for 'Urban Threads', a minimalist clothing brand..."
          class="flex-1 w-full rounded-xl border border-gray-200 bg-gray-50/30 p-4 text-sm focus:bg-white focus:border-purple-200 outline-none transition-all resize-none leading-relaxed"
        ></textarea>
        <p class="text-[11px] text-gray-400 leading-tight">Define how the AI should behave, what it knows about your brand, and any specific selling guidelines.</p>
      </Card>
    </div>

    <Card class="bg-indigo-900 p-6 text-white shadow-xl shadow-indigo-100 border-indigo-800">
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
            <Input
              type="text"
              readonly
              value={tempMcpKey}
              class="bg-indigo-900 border-indigo-700 text-indigo-100 font-mono"
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
          <div class="flex-1">
            <Select
              id="duration"
              label="Duration"
              bind:value={tempKeyDuration}
              options={[
                { value: 60, label: "1 Hour" },
                { value: 240, label: "4 Hours" },
                { value: 480, label: "8 Hours" },
                { value: 1440, label: "24 Hours" }
              ]}
              style="background-color: rgb(55 48 163); border-color: rgb(67 56 202); color: white;"
            />
          </div>
          <div class="flex-1 pt-6">
            <Button
              onclick={generateMcpKey}
              disabled={tempKeyLoading}
              class="w-full h-[46px] bg-white text-indigo-900 border-none hover:bg-indigo-50 shadow-lg"
            >
              {tempKeyLoading ? "Generating..." : "Generate Access Key"}
            </Button>
          </div>
        </div>
      {/if}
    </Card>

    <!-- Actions Bar -->
    <div class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-4 -mx-6 flex items-center justify-between z-20">
      <div class="flex items-center gap-3">
        <Button
          onclick={saveAi}
          disabled={saving}
          variant="primary"
          class="px-8 py-3 bg-purple-600 border-none hover:bg-purple-700 shadow-purple-100"
        >
          {#if saving}
            <RefreshCw size={18} class="animate-spin mr-2" /> Saving...
          {:else if saved}
            <Check size={18} class="mr-2" /> Saved!
          {:else}
            Confirm AI Settings
          {/if}
        </Button>

        <!-- Sync Status -->
        {#if aiGatewayStatus === "synced"}
          <div class="px-4 py-2 rounded-xl bg-green-50 text-green-700 border border-green-100 flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-left-4">
            <div class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            <span class="text-[11px] font-black uppercase tracking-tight">Synced to Gateway</span>
          </div>
        {:else if aiGatewayStatus === "checking"}
          <div class="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-2">
            <RefreshCw size={12} class="animate-spin" />
            <span class="text-[11px] font-black uppercase tracking-tight">Verifying Sync...</span>
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
