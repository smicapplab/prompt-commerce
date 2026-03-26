<script lang="ts">
  import { Eye, EyeOff, ShieldCheck } from "@lucide/svelte";
  import { goto } from "$app/navigation";

  // ── Step 1: sign-in ─────────────────────────────────────────────────────────
  let username = $state("");
  let password = $state("");
  let showPassword = $state(false);

  // ── Step 2: set new password ─────────────────────────────────────────────────
  let step = $state<"login" | "set-password">("login");
  let newPassword = $state("");
  let confirmPass = $state("");
  let showNew = $state(false);
  let showConfirm = $state(false);
  let pendingToken = $state(""); // real JWT held until password is changed
  let pendingUserId = $state(0);

  let error = $state("");
  let loading = $state(false);

  // ── Step 1 handler ───────────────────────────────────────────────────────────
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

      if (data.needsPasswordChange) {
        // Hold the token and transition to step 2 instead of entering the admin
        pendingToken = data.token;
        pendingUserId = JSON.parse(atob(data.token.split(".")[1])).sub;
        step = "set-password";
      } else {
        localStorage.setItem("pc_token", data.token);
        goto("/admin");
      }
    } catch {
      error = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  // ── Step 2 handler ───────────────────────────────────────────────────────────
  async function handleSetPassword(e: SubmitEvent) {
    e.preventDefault();
    error = "";

    if (newPassword.length < 8) {
      error = "Password must be at least 8 characters.";
      return;
    }
    if (newPassword !== confirmPass) {
      error = "Passwords do not match.";
      return;
    }

    loading = true;
    try {
      const res = await fetch(`/api/users/${pendingUserId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pendingToken}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        error = d.error ?? "Could not update password. Please try again.";
        return;
      }
      // Password changed — now enter the admin
      localStorage.setItem("pc_token", pendingToken);
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
    <div class="flex items-baseline gap-2 justify-center mb-5">
      <img src="/logo-2.png" alt="Prompt Commerce" class="h-8" />
      <div class="font-semibold text-2xl text-cyan-800">Prompt Commerce</div>
    </div>

    {#if error}
      <div
        class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4"
      >
        {error}
      </div>
    {/if}

    <!-- ── Step 1: username + password ──────────────────────────────────────── -->
    {#if step === "login"}
      <form onsubmit={handleLogin} class="space-y-4">
        <div>
          <label
            for="login-username"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Username
          </label>
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
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
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

      <!-- ── Step 2: set a new password ───────────────────────────────────────── -->
    {:else}
      <div class="flex flex-col items-center gap-2 mb-5 text-center">
        <div
          class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center"
        >
          <ShieldCheck class="w-6 h-6 text-amber-600" />
        </div>
        <h2 class="text-base font-semibold text-gray-900">Set your password</h2>
        <p class="text-sm text-gray-500">
          You're using the default password. Please choose a new one before
          continuing.
        </p>
      </div>

      <form onsubmit={handleSetPassword} class="space-y-4">
        <div>
          <label
            for="new-password"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            New password
          </label>
          <div class="relative">
            <input
              id="new-password"
              bind:value={newPassword}
              type={showNew ? "text" : "password"}
              placeholder="Min. 8 characters"
              required
              minlength="8"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onclick={() => (showNew = !showNew)}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {#if showNew}<EyeOff class="w-4 h-4" />{:else}<Eye
                  class="w-4 h-4"
                />{/if}
            </button>
          </div>
        </div>

        <div>
          <label
            for="confirm-password"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm password
          </label>
          <div class="relative">
            <input
              id="confirm-password"
              bind:value={confirmPass}
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onclick={() => (showConfirm = !showConfirm)}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {#if showConfirm}<EyeOff class="w-4 h-4" />{:else}<Eye
                  class="w-4 h-4"
                />{/if}
            </button>
          </div>
        </div>

        <!-- Password strength hint -->
        {#if newPassword.length > 0 && newPassword.length < 8}
          <p class="text-xs text-amber-600">
            Password is too short (need {8 - newPassword.length} more character{8 -
              newPassword.length ===
            1
              ? ""
              : "s"}).
          </p>
        {:else if newPassword.length >= 8 && confirmPass.length > 0 && newPassword !== confirmPass}
          <p class="text-xs text-red-600">Passwords don't match yet.</p>
        {:else if newPassword.length >= 8 && confirmPass === newPassword}
          <p class="text-xs text-green-600">✓ Passwords match.</p>
        {/if}

        <button
          type="submit"
          disabled={loading ||
            newPassword.length < 8 ||
            newPassword !== confirmPass}
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
        >
          {loading ? "Saving…" : "Set password & continue"}
        </button>
      </form>
    {/if}
  </div>
</div>
