<script lang="ts">
  import { Eye, EyeOff, ShieldCheck, Lock, User, ArrowRight } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { fade, fly, scale } from "svelte/transition";
  import Button from "$lib/components/ui/Button.svelte";

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

<div class="min-h-screen bg-mesh flex items-center justify-center p-4 relative overflow-hidden">
  <!-- Subtle Background Decorations -->
  <div class="absolute top-[10%] left-[5%] w-64 h-64 bg-indigo-300/20 rounded-full blur-3xl animate-pulse"></div>
  <div class="absolute bottom-[10%] right-[5%] w-96 h-96 bg-cyan-300/20 rounded-full blur-3xl animate-pulse" style="animation-delay: 2s;"></div>

  <div
    in:fly={{ y: 20, duration: 800 }}
    class="backdrop-blur-xl bg-white/70 rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 border border-white/50 w-full max-w-md overflow-hidden relative"
  >
    <div class="p-8 md:p-12">
      <div class="flex flex-col items-center justify-center mb-10">
        <div class="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-indigo-50/50">
          <img src="/logo-2.png" alt="Prompt Commerce" class="h-10" />
        </div>
        <div class="text-center">
          <h1 class="font-bold text-3xl text-indigo-950 tracking-tight">Prompt Commerce</h1>
          <p class="text-indigo-600/60 font-medium text-sm mt-1 uppercase tracking-widest">Seller Admin</p>
        </div>
      </div>

      {#if error}
        <div
          in:fade={{ duration: 200 }}
          class="bg-red-50/50 backdrop-blur-sm border border-red-100 text-red-600 text-sm rounded-2xl px-5 py-4 mb-6 flex items-start gap-3"
        >
          <div class="shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 mt-0.5">!</div>
          <p class="font-medium leading-relaxed">{error}</p>
        </div>
      {/if}

      <!-- ── Step 1: username + password ──────────────────────────────────────── -->
      {#if step === "login"}
        <div in:fade={{ duration: 400 }}>
          <form onsubmit={handleLogin} class="space-y-6">
            <div class="space-y-1.5">
              <label
                for="login-username"
                class="block text-[13px] font-bold text-indigo-900/40 uppercase tracking-wider ml-1"
              >
                Username
              </label>
              <div class="relative group">
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-500 transition-colors">
                  <User class="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  bind:value={username}
                  type="text"
                  placeholder="admin"
                  required
                  class="w-full bg-white/50 border border-indigo-100 rounded-2xl pl-11 pr-4 py-3.5 text-[15px] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-indigo-200"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label
                for="login-password"
                class="block text-[13px] font-bold text-indigo-900/40 uppercase tracking-wider ml-1"
              >
                Password
              </label>
              <div class="relative group">
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-500 transition-colors">
                  <Lock class="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  bind:value={password}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  class="w-full bg-white/50 border border-indigo-100 rounded-2xl pl-11 pr-12 py-3.5 text-[15px] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-indigo-200"
                />
                <button
                  type="button"
                  onclick={() => (showPassword = !showPassword)}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-indigo-500 transition-colors"
                >
                  {#if showPassword}<EyeOff class="w-5 h-5" />{:else}<Eye
                      class="w-5 h-5"
                    />{/if}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              class="w-full mt-4 shadow-lg shadow-indigo-600/20 group"
            >
              {#if loading}
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {/if}
              {loading ? "Verifying..." : "Sign in"}
              <ArrowRight class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </form>
        </div>

        <!-- ── Step 2: set a new password ───────────────────────────────────────── -->
      {:else}
        <div in:scale={{ duration: 400, start: 0.95 }}>
          <div class="flex flex-col items-center gap-3 mb-8 text-center">
            <div
              class="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100 shadow-sm"
            >
              <ShieldCheck class="w-8 h-8" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-indigo-950">Secure your account</h2>
              <p class="text-[15px] text-indigo-900/40 font-medium mt-1">
                Please update your default password to continue.
              </p>
            </div>
          </div>

          <form onsubmit={handleSetPassword} class="space-y-6">
            <div class="space-y-1.5">
              <label
                for="new-password"
                class="block text-[13px] font-bold text-indigo-900/40 uppercase tracking-wider ml-1"
              >
                New password
              </label>
              <div class="relative group">
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-500 transition-colors">
                  <Lock class="w-4 h-4" />
                </div>
                <input
                  id="new-password"
                  bind:value={newPassword}
                  type={showNew ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  required
                  minlength="8"
                  class="w-full bg-white/50 border border-indigo-100 rounded-2xl pl-11 pr-12 py-3.5 text-[15px] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-indigo-200"
                />
                <button
                  type="button"
                  onclick={() => (showNew = !showNew)}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-indigo-500 transition-colors"
                >
                  {#if showNew}<EyeOff class="w-5 h-5" />{:else}<Eye
                      class="w-5 h-5"
                    />{/if}
                </button>
              </div>
            </div>

            <div class="space-y-1.5">
              <label
                for="confirm-password"
                class="block text-[13px] font-bold text-indigo-900/40 uppercase tracking-wider ml-1"
              >
                Confirm password
              </label>
              <div class="relative group">
                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-500 transition-colors">
                  <Lock class="w-4 h-4" />
                </div>
                <input
                  id="confirm-password"
                  bind:value={confirmPass}
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  class="w-full bg-white/50 border border-indigo-100 rounded-2xl pl-11 pr-12 py-3.5 text-[15px] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-indigo-200"
                />
                <button
                  type="button"
                  onclick={() => (showConfirm = !showConfirm)}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-indigo-500 transition-colors"
                >
                  {#if showConfirm}<EyeOff class="w-5 h-5" />{:else}<Eye
                      class="w-5 h-5"
                    />{/if}
                </button>
              </div>
            </div>

            <!-- Password strength hint -->
            <div class="px-1 min-h-[20px]">
              {#if newPassword.length > 0 && newPassword.length < 8}
                <p class="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Need {8 - newPassword.length} more characters.
                </p>
              {:else if newPassword.length >= 8 && confirmPass.length > 0 && newPassword !== confirmPass}
                <p class="text-xs font-semibold text-red-500 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Passwords don't match yet.
                </p>
              {:else if newPassword.length >= 8 && confirmPass === newPassword}
                <p class="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Passwords match!
                </p>
              {/if}
            </div>

            <Button
              type="submit"
              disabled={loading ||
                newPassword.length < 8 ||
                newPassword !== confirmPass}
              size="lg"
              class="w-full mt-2 shadow-lg shadow-indigo-600/20 group"
            >
              {loading ? "Saving..." : "Set password & continue"}
              <ArrowRight class="w-4 h-4 group-hover:translate-x-0.5 transition-transform ml-1" />
            </Button>
          </form>
        </div>
      {/if}
    </div>
  </div>
</div>
