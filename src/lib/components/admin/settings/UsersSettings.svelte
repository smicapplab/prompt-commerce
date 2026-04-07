<script lang="ts">
  import { 
    UserRoundCog, 
    UserRoundPlus, 
    Check, 
    Trash2, 
    Pencil, 
    Shield, 
    Lock, 
    Eye, 
    EyeOff, 
    AtSign, 
    Fingerprint,
    Phone,
    Users,
    Search
  } from "@lucide/svelte";

  let { 
    activeStore,
    usersList,
    userRole,
    showAddUserModal = $bindable(),
    showEditUserModal = $bindable(),
    newUserName = $bindable(),
    newUserPass = $bindable(),
    newUserFirstName = $bindable(),
    newUserLastName = $bindable(),
    newUserEmail = $bindable(),
    newUserMobile = $bindable(),
    newUserRole = $bindable(),
    showNewUserPass = $bindable(),
    editingUser = $bindable(),
    showEditUserPass = $bindable(),
    saving,
    error,
    addUser,
    updateUser,
    deleteUser,
    openEditModal
  } = $props();

  let searchQuery = $state("");
  let filteredUsers = $derived(
    usersList.filter((u: any) => 
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.first_name + " " + u.last_name).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
</script>

<div class="space-y-8 animate-in fade-in duration-500 pb-20">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h2 class="text-2xl font-bold text-gray-900 tracking-tight">Access Control</h2>
      <p class="text-sm text-gray-500 mt-1">
        {activeStore.slug 
          ? `Manage who can access the settings for ${activeStore.name}.` 
          : "Global administrators with system-wide permissions."}
      </p>
    </div>
    <button
      onclick={() => (showAddUserModal = true)}
      class="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-black active:scale-95 transition-all shadow-lg"
    >
      <UserRoundPlus size={18} /> Add New User
    </button>
  </div>

  <!-- Users Table Card -->
  <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
    <div class="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
       <div class="relative w-full max-w-xs">
          <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            bind:value={searchQuery}
            placeholder="Search team..." 
            class="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-1.5 text-xs focus:border-indigo-500 outline-none transition-all"
          />
       </div>
       <div class="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-widest">
          <Users size={12} />
          {filteredUsers.length} Users
       </div>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-100">
        <thead>
          <tr class="bg-white">
            <th class="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Team Member</th>
            <th class="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</th>
            <th class="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
            <th class="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Control</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          {#each filteredUsers as user}
            <tr class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm uppercase">
                    {user.username[0]}
                  </div>
                  <div>
                    <div class="text-sm font-bold text-gray-900">{user.first_name} {user.last_name}</div>
                    <div class="text-[11px] font-mono text-gray-400">@{user.username}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-col gap-1">
                   <div class="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <AtSign size={12} class="text-gray-300" /> {user.email || 'No email'}
                   </div>
                   <div class="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <Phone size={12} class="text-gray-300" /> {user.mobile || 'No mobile'}
                   </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight 
                  {user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}">
                  <Shield size={10} /> {user.role.replace('_', ' ')}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    onclick={() => openEditModal(user)}
                    class="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all"
                    title="Edit user"
                  >
                    <Pencil size={16} />
                  </button>
                  {#if user.role !== 'super_admin' || userRole === 'super_admin'}
                    <button
                      onclick={() => deleteUser(user.id)}
                      class="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all"
                      title="Remove user"
                    >
                      <Trash2 size={16} />
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Modals -->
{#if showAddUserModal}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] transition-all p-4">
    <div class="fixed inset-0" onclick={() => showAddUserModal = false} onkeydown={(e) => e.key === 'Escape' && (showAddUserModal = false)} role="button" tabindex="-1" aria-label="Close modal"></div>
    <div class="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200 relative z-10">
      <div class="flex items-center gap-3">
         <div class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-900">
            <UserRoundPlus size={24} />
         </div>
         <div>
            <h3 class="text-xl font-black text-gray-900 leading-none">New Account</h3>
            <p class="text-xs text-gray-500 mt-1">Configure profile and permissions for the new user.</p>
         </div>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <div class="space-y-1.5 focus-within:text-indigo-600 transition-colors">
          <label for="n-fname" class="text-[11px] font-black uppercase tracking-widest px-1">First Name</label>
          <input id="n-fname" type="text" bind:value={newUserFirstName} class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all" />
        </div>
        <div class="space-y-1.5 focus-within:text-indigo-600 transition-colors">
          <label for="n-lname" class="text-[11px] font-black uppercase tracking-widest px-1">Last Name</label>
          <input id="n-lname" type="text" bind:value={newUserLastName} class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div class="space-y-1.5 focus-within:text-indigo-600 transition-colors">
           <label for="n-user" class="text-[11px] font-black uppercase tracking-widest px-1 flex items-center gap-2">
             <AtSign size={12} /> Username
           </label>
           <input id="n-user" type="text" bind:value={newUserName} placeholder="johndoe" class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all" />
         </div>
         <div class="space-y-1.5 focus-within:text-indigo-600 transition-colors">
           <label for="n-pass" class="text-[11px] font-black uppercase tracking-widest px-1 flex items-center gap-2">
             <Fingerprint size={12} /> Password
           </label>
           <div class="relative">
             <input id="n-pass" type={showNewUserPass ? "text" : "password"} bind:value={newUserPass} class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 pr-10 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all" />
             <button onclick={() => (showNewUserPass = !showNewUserPass)} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600">
               {#if showNewUserPass}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
             </button>
           </div>
         </div>
      </div>

      <div class="space-y-1.5 focus-within:text-indigo-600 transition-colors">
         <label for="n-role" class="text-[11px] font-black uppercase tracking-widest px-1 flex items-center gap-2">
           <Lock size={12} /> Assigned Permissions
         </label>
         <select id="n-role" bind:value={newUserRole} class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer">
           <option value="super_admin">Super Administrator</option>
           <option value="store_admin">Store Administrator</option>
           <option value="merchandising">Merchandising / Products</option>
           <option value="ops">Fulfillment / Operations</option>
         </select>
      </div>

      {#if error}
        <div class="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-bold text-red-600 animate-in shake-in-1 duration-200">
           {error}
        </div>
      {/if}

      <div class="flex items-center gap-3 pt-2">
        <button onclick={addUser} disabled={saving} class="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-black text-white hover:bg-black active:scale-95 transition-all shadow-xl shadow-gray-200">
           {saving ? 'Creating...' : 'Finalize Account'}
        </button>
        <button onclick={() => (showAddUserModal = false)} class="px-6 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-500 hover:bg-gray-200 transition-all">Cancel</button>
      </div>
    </div>
  </div>
{/if}

{#if showEditUserModal && editingUser}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] transition-all p-4">
    <div class="fixed inset-0" onclick={() => showEditUserModal = false} onkeydown={(e) => e.key === 'Escape' && (showEditUserModal = false)} role="button" tabindex="-1" aria-label="Close modal"></div>
    <div class="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200 relative z-10">
      <div class="flex items-center gap-3">
         <div class="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <UserRoundCog size={24} />
         </div>
         <div>
            <h3 class="text-xl font-black text-gray-900 leading-none">Modify Profile</h3>
            <p class="text-xs text-gray-500 mt-1">Updating settings for @{editingUser.username}</p>
         </div>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <div class="space-y-1.5 focus-within:text-indigo-600 transition-colors">
          <label for="e-fname" class="text-[11px] font-black uppercase tracking-widest px-1">First Name</label>
          <input id="e-fname" type="text" bind:value={editingUser.first_name} class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all" />
        </div>
        <div class="space-y-1.5 focus-within:text-indigo-600 transition-colors">
          <label for="e-lname" class="text-[11px] font-black uppercase tracking-widest px-1">Last Name</label>
          <input id="e-lname" type="text" bind:value={editingUser.last_name} class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all" />
        </div>
      </div>

      <div class="space-y-1.5 focus-within:text-indigo-600 transition-colors">
        <label for="e-pass" class="text-[11px] font-black uppercase tracking-widest px-1">Reset Password (Blank to keep)</label>
        <div class="relative">
          <input id="e-pass" type={showEditUserPass ? "text" : "password"} bind:value={editingUser.newPassword} class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 pr-10 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all" placeholder="Enter new password..." />
           <button onclick={() => (showEditUserPass = !showEditUserPass)} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600">
               {#if showEditUserPass}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
             </button>
        </div>
      </div>

      <div class="flex items-center gap-3 pt-4">
        <button onclick={updateUser} disabled={saving} class="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-black text-white hover:bg-black active:scale-95 transition-all shadow-xl">
           {saving ? 'Updating...' : 'Apply Changes'}
        </button>
        <button onclick={() => (showEditUserModal = false)} class="px-6 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-500 hover:bg-gray-200 transition-all">Discard</button>
      </div>
    </div>
  </div>
{/if}
