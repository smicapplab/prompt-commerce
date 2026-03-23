<script lang="ts">
  import { Zap, Eye, EyeOff } from "@lucide/svelte";
  import { goto } from "$app/navigation";

  let username = $state("");
  let password = $state("");
  let showPassword = $state(false);
  let error = $state("");
  let loading = $state(false);

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    loading = true;
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        error = data.error ?? "Login failed";
        return;
      }
      localStorage.setItem("pc_token", data.token);
      goto("/admin");
    } catch {
      error = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Sign in — Prompt Commerce</title></svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div
    class="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8"
  >
    <div class="flex items-center gap-2 justify-center mb-1">
      <Zap class="w-5 h-5 text-yellow-400" />
      <span class="font-semibold text-gray-900">Prompt Commerce</span>
    </div>
    <p class="text-center text-sm text-gray-500 mb-6">Store Admin</p>

    {#if error}
      <div
        class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4"
      >
        {error}
      </div>
    {/if}

    <form onsubmit={handleLogin} class="space-y-4">
      <div>
        <label
          for="login-username"
          class="block text-sm font-medium text-gray-700 mb-1">Username</label
        >
        <input
          id="login-username"
          bind:value={username}
          type="text"
          placeholder="admin"
          required
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label
          for="login-password"
          class="block text-sm font-medium text-gray-700 mb-1">Password</label
        >
        <div class="relative">
          <input
            id="login-password"
            bind:value={password}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onclick={() => (showPassword = !showPassword)}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {#if showPassword}<EyeOff class="w-4 h-4" />{:else}<Eye
                class="w-4 h-4"
              />{/if}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  </div>
</div>
