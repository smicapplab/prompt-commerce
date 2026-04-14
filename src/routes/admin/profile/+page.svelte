<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { 
    User, 
    Mail, 
    Lock, 
    Eye, 
    EyeOff, 
    RefreshCw, 
    ShieldCheck, 
    Check, 
    X,
    UserCircle,
    Fingerprint,
    Calendar,
    Save,
    AlertCircle,
    Wand2
  } from '@lucide/svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Input from '$lib/components/ui/Input.svelte';

  let user = $state<any>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state("");
  let success = $state("");

  // Update states
  let firstName = $state("");
  let lastName = $state("");
  let email = $state("");
  let mobile = $state("");
  let newPassword = $state("");
  let showPassword = $state(false);

  // Validation checks
  const emailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const mobileValid = $derived(mobile === "" || /^\+?[0-9\s\-.()]{7,20}$/.test(mobile));

  // Password rules validation
  const rules = $derived([
    { id: 'len', text: 'At least 8 characters', met: newPassword.length >= 8 },
    { id: 'num', text: 'Contains a number', met: /[0-9]/.test(newPassword) },
    { id: 'spec', text: 'Uppercase or symbol', met: /[A-Z!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) }
  ]);

  const allRulesMet = $derived((newPassword === "" || rules.every(r => r.met)) && emailValid && mobileValid);
  const isDirty = $derived(
    user && (
      firstName !== user.first_name ||
      lastName !== user.last_name ||
      email !== user.email ||
      mobile !== (user.mobile || "") ||
      newPassword !== ""
    )
  );

  const token = () => localStorage.getItem('pc_token') ?? '';

  onMount(async () => {
    try {
      const res = await fetch('/api/users/profile', {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        user = await res.json();
        firstName = user.first_name;
        lastName = user.last_name;
        email = user.email;
        mobile = user.mobile || "";
      } else {
        error = "Failed to load profile";
      }
    } catch (e) {
      error = "Connection error";
    } finally {
      loading = false;
    }
  });

  function generatePassword() {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    
    // Ensure we meet our own rules
    retVal += "ABC"[Math.floor(Math.random() * 3)]; // Upper
    retVal += "123"[Math.floor(Math.random() * 3)]; // Number
    retVal += "!@#"[Math.floor(Math.random() * 3)]; // Symbol
    
    for (var i = 3, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    
    newPassword = retVal.split('').sort(() => 0.5 - Math.random()).join('');
    showPassword = true;
  }

  async function handleUpdate() {
    if (saving || !allRulesMet) return;
    
    saving = true;
    error = "";
    success = "";

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}` 
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          mobile,
          password: newPassword || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        success = "Profile updated successfully";
        newPassword = "";
        // Refresh local user data
        const getRes = await fetch('/api/users/profile', {
          headers: { Authorization: `Bearer ${token()}` }
        });
        if (getRes.ok) user = await getRes.json();
      } else {
        error = data.error || "Update failed";
      }
    } catch (e) {
      error = "Connection error";
    } finally {
      saving = false;
    }
  }
</script>

<div class="px-6 pt-6 pb-20 max-w-6xl mx-auto space-y-10">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
    <div>
      <h1 class="text-2xl font-black text-gray-900 tracking-tight">Account Profile</h1>
      <div class="flex items-center gap-2 mt-1">
        <div class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Admin Dashboard / Personal Identity</span>
      </div>
    </div>
    
    {#if user}
      <div class="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <Fingerprint size={20} />
        </div>
        <div>
          <p class="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Signed in as</p>
          <p class="text-sm font-bold text-gray-900 leading-none">@{user.username}</p>
        </div>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex flex-col items-center justify-center py-24 gap-4" in:fade>
      <RefreshCw size={40} class="animate-spin text-indigo-200" />
      <p class="text-gray-400 font-bold animate-pulse text-sm">Syncing your profile...</p>
    </div>
  {:else if error && !user}
    <div class="bg-red-50 border border-red-100 p-8 rounded-3xl text-center space-y-4" in:fade>
      <div class="w-16 h-16 bg-white rounded-2xl shadow-sm border border-red-100 flex items-center justify-center text-red-500 mx-auto">
        <AlertCircle size={32} />
      </div>
      <h3 class="text-xl font-bold text-red-900">Connection Interrupted</h3>
      <p class="text-red-700/70 max-w-xs mx-auto text-sm">{error}</p>
      <Button variant="secondary" onclick={() => location.reload()}>Try Again</Button>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" in:fade={{ duration: 400 }}>
      <!-- Sidebar Info -->
      <div class="lg:col-span-4 space-y-6">
        <Card class="overflow-hidden border-none shadow-2xl shadow-indigo-100/50">
          <div class="aspect-square bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center relative overflow-hidden">
            <!-- Decorative patterns -->
            <div class="absolute inset-0 opacity-10">
              <div class="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <div class="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -ml-16 -mb-16 blur-3xl"></div>
            </div>
            
            <span class="text-8xl font-black text-white/20 select-none uppercase">{user.username[0]}</span>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-24 h-24 rounded-3xl bg-white shadow-2xl flex items-center justify-center text-indigo-600 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                <User size={48} strokeWidth={2.5} />
              </div>
            </div>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <h3 class="text-xl font-black text-gray-900 leading-tight">{user.first_name} {user.last_name}</h3>
              <p class="text-sm text-gray-500 font-medium">System {user.role.replace('_', ' ')}</p>
            </div>
            
            <div class="h-px bg-gray-100"></div>
            
            <div class="space-y-3">
              <div class="flex items-center gap-3 text-gray-500">
                <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <Mail size={16} />
                </div>
                <span class="text-xs font-bold truncate">{user.email}</span>
              </div>
              <div class="flex items-center gap-3 text-gray-500">
                <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <Calendar size={16} />
                </div>
                <span class="text-xs font-bold">Joined {new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </Card>
        
        <div class="p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100/50">
          <div class="flex items-center gap-3 mb-2 text-indigo-700">
            <ShieldCheck size={20} />
            <h4 class="font-black text-sm uppercase tracking-wider">Privacy Note</h4>
          </div>
          <p class="text-xs text-indigo-900/60 leading-relaxed font-medium">
            Your personal information is only accessible to system administrators. Changes to your email will require you to log in again with the new credentials.
          </p>
        </div>
      </div>

      <!-- Main Form -->
      <form class="lg:col-span-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
        {#if success}
          <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 shadow-sm animate-in slide-in-from-top-2" transition:slide>
            <div class="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-emerald-500">
              <Check size={18} strokeWidth={3} />
            </div>
            <p class="text-sm font-bold">{success}</p>
          </div>
        {/if}

        {#if error}
          <div class="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700 shadow-sm animate-in slide-in-from-top-2" transition:slide>
            <AlertCircle size={18} />
            <p class="text-sm font-bold">{error}</p>
          </div>
        {/if}

        <Card class="p-8 space-y-8 border-none shadow-xl shadow-gray-200/50 overflow-visible">
          <!-- Identity Section -->
          <div class="space-y-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                <UserCircle size={20} />
              </div>
              <h3 class="text-lg font-black text-gray-900">Personal Details</h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input id="fname" label="First Name" bind:value={firstName} placeholder="John" />
              <Input id="lname" label="Last Name" bind:value={lastName} placeholder="Doe" />
              <div class="md:col-span-2">
                <Input 
                  id="email" 
                  label="Email Address" 
                  type="email" 
                  bind:value={email} 
                  placeholder="john@example.com" 
                  class={!emailValid && email !== "" ? 'border-red-300 bg-red-50/10' : ''}
                />
                {#if !emailValid && email !== ""}
                  <p class="text-[10px] text-red-500 font-bold mt-1 ml-2">Please enter a valid email address</p>
                {/if}
              </div>
              <div class="md:col-span-2">
                <Input 
                  id="mobile" 
                  label="Mobile Number (Optional)" 
                  bind:value={mobile} 
                  placeholder="+63 9xx xxx xxxx" 
                  class={!mobileValid && mobile !== "" ? 'border-red-300 bg-red-50/10' : ''}
                />
                {#if !mobileValid && mobile !== ""}
                  <p class="text-[10px] text-red-500 font-bold mt-1 ml-2">Format: +63 9xx... or local numbers</p>
                {/if}
              </div>
            </div>
          </div>

          <div class="h-px bg-gray-100"></div>

          <!-- Security Section -->
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-lg shadow-orange-100/50">
                  <Lock size={20} />
                </div>
                <h3 class="text-lg font-black text-gray-900">Credentials</h3>
              </div>
              
              <Button variant="ghost" size="sm" class="text-indigo-600 hover:bg-indigo-50 font-black h-10 rounded-xl" onclick={generatePassword}>
                <Wand2 size={16} class="mr-2" />
                Generate
              </Button>
            </div>

            <div class="relative group">
              <Input 
                id="pass" 
                label="Change Password" 
                type={showPassword ? "text" : "password"} 
                bind:value={newPassword} 
                placeholder="Leave blank to keep current" 
                class="pr-24 font-mono {newPassword !== '' && !allRulesMet ? 'border-red-200' : ''}"
              />
              <div class="absolute right-2 top-8 flex items-center gap-1 group-focus-within:opacity-100 transition-opacity">
                <button 
                  type="button"
                  onclick={() => showPassword = !showPassword} 
                  class="p-2 text-gray-300 hover:text-indigo-500 transition-colors"
                >
                  {#if showPassword}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
                </button>
              </div>
              
              {#if newPassword !== ""}
                <div class="mt-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3" transition:slide>
                  <p class="text-[10px] font-black uppercase text-gray-400 tracking-wider">Security Requirements</p>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {#each rules as rule}
                      <div class="flex items-center gap-2">
                        {#if rule.met}
                          <div class="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center" in:fade>
                            <Check size={12} strokeWidth={4} />
                          </div>
                        {:else}
                          <div class="w-5 h-5 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center">
                            <X size={12} strokeWidth={4} />
                          </div>
                        {/if}
                        <span class="text-[11px] font-bold {rule.met ? 'text-emerald-700' : 'text-gray-400'}">{rule.text}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </Card>

        <!-- Sticky Footer Actions -->
        <div class="sticky bottom-0 backdrop-blur-md border-t border-gray-100 p-4 -mx-6 flex items-center justify-between z-20 mt-10">
          <div class="flex items-center gap-3">
            <Button 
              type="submit" 
              variant="primary" 
              disabled={saving || !isDirty || !allRulesMet} 
              class="px-8 py-3 bg-gray-900 border-none hover:bg-black shadow-xl shadow-gray-200 transition-all font-black disabled:opacity-30"
            >
              {#if saving}
                <RefreshCw size={18} class="animate-spin mr-2" />
                Saving...
              {:else}
                <Save size={18} class="mr-2" />
                Update Profile
              {/if}
            </Button>

            {#if success}
              <div transition:fade class="flex items-center gap-2 text-[10px] font-black uppercase text-green-600 tracking-widest">
                <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                Profile Secured
              </div>
            {/if}
          </div>

          <p class="hidden md:block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Last updated {new Date(user.updated_at || user.created_at).toLocaleDateString()}
          </p>
        </div>
      </form>
    </div>
  {/if}
</div>

<style>
  :global(.animate-in) {
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
