<script lang="ts">
  import {
    UserRoundCog,
    UserRoundPlus,
    Trash2,
    Pencil,
    Shield,
    Lock,
    Eye,
    EyeOff,
    AtSign,
    FingerprintPattern,
    Phone,
    Users,
    Search,
    RefreshCw,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { activeStore } from "$lib/stores/activeStore.svelte.js";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import { fade } from "svelte/transition";

  // Internal state
  let usersList = $state<any[]>([]);
  let userRole = $state("");
  let loading = $state(false);
  let saving = $state(false);
  let error = $state("");

  // Modals & Forms
  let showAddUserModal = $state(false);
  let showEditUserModal = $state(false);

  let newUserName = $state("");
  let newUserPass = $state("");
  let newUserFirstName = $state("");
  let newUserLastName = $state("");
  let newUserEmail = $state("");
  let newUserMobile = $state("");
  let newUserRole = $state("store_admin");
  let showNewUserPass = $state(false);

  let editingUser = $state<any>(null);
  let showEditUserPass = $state(false);

  const token = () => localStorage.getItem("pc_token") ?? "";

  $effect(() => {
    // Only fetch if a store is active OR if we're a super admin looking at global users
    if (activeStore.slug || userRole === "super_admin") {
      load();
    }
  });

  async function load() {
    loading = true;
    error = "";
    try {
      // Get current user role first
      const meRes = await fetch("/api/users/profile", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        userRole = me.role;
      }

      const url = activeStore.slug
        ? `/api/stores/${activeStore.slug}/users`
        : "/api/users";

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        usersList = await res.json();
      }
    } catch (e) {
      error = "Failed to load users";
    } finally {
      loading = false;
    }
  }

  async function addUser() {
    saving = true;
    error = "";
    try {
      const url = activeStore.slug
        ? `/api/stores/${activeStore.slug}/users`
        : "/api/users";

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          username: newUserName,
          password: newUserPass,
          first_name: newUserFirstName,
          last_name: newUserLastName,
          email: newUserEmail,
          mobile: newUserMobile,
          role: newUserRole,
        }),
      });

      if (res.ok) {
        showAddUserModal = false;
        newUserName =
          newUserPass =
          newUserFirstName =
          newUserLastName =
          newUserEmail =
          newUserMobile =
            "";
        await load();
      } else {
        const d = await res.json();
        error = d.error ?? "Failed to add user";
      }
    } catch {
      error = "Connection error";
    } finally {
      saving = false;
    }
  }

  function openEditModal(user: any) {
    editingUser = { ...user, newPassword: "" };
    showEditUserModal = true;
  }

  async function updateUser() {
    if (!editingUser) return;
    saving = true;
    error = "";
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          first_name: editingUser.first_name,
          last_name: editingUser.last_name,
          password: editingUser.newPassword || undefined,
        }),
      });

      if (res.ok) {
        showEditUserModal = false;
        editingUser = null;
        await load();
      } else {
        const d = await res.json();
        error = d.error ?? "Update failed";
      }
    } catch {
      error = "Connection error";
    } finally {
      saving = false;
    }
  }

  async function deleteUser(id: number) {
    if (!confirm("Are you sure you want to remove this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) await load();
    } catch {
      alert("Failed to delete user");
    }
  }

  let searchQuery = $state("");
  let filteredUsers = $derived(
    usersList.filter(
      (u: any) =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.first_name + " " + u.last_name)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    ),
  );
</script>

<div class="space-y-8 animate-in fade-in duration-500 pb-20">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h2 class="text-2xl font-bold text-gray-900 tracking-tight">
        Access Control
      </h2>
      <p class="text-sm text-gray-500 mt-1">
        {activeStore.slug
          ? `Manage who can access settings for ${activeStore.name}.`
          : "Global administrators with system-wide permissions."}
      </p>
    </div>
    <Button
      variant="primary"
      onclick={() => (showAddUserModal = true)}
      class="gap-2 bg-gray-900 border-none hover:bg-black shadow-lg"
    >
      <UserRoundPlus size={18} /> Add New User
    </Button>
  </div>

  {#if loading && usersList.length === 0}
    <div class="flex items-center justify-center py-20">
      <RefreshCw size={32} class="animate-spin text-gray-300" />
    </div>
  {:else}
    <!-- Users Table Card -->
    <Card class="overflow-hidden flex flex-col p-0">
      <div
        class="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between"
      >
        <div class="relative w-full max-w-xs">
          <Input
            id="user-search"
            bind:value={searchQuery}
            placeholder="Search team..."
            class="text-xs py-1.5"
          >
            {#snippet left()}
              <Search size={14} />
            {/snippet}
          </Input>
        </div>
        <div
          class="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-widest"
        >
          <Users size={12} />
          {filteredUsers.length} Users
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-100">
          <thead>
            <tr class="bg-white">
              <th
                class="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest"
                >Team Member</th
              >
              <th
                class="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest"
                >Contact</th
              >
              <th
                class="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest"
                >Role</th
              >
              <th
                class="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest"
                >Control</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each filteredUsers as user}
              <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-4">
                    <div
                      class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm uppercase"
                    >
                      {user.username[0]}
                    </div>
                    <div>
                      <div class="text-sm font-bold text-gray-900">
                        {user.first_name}
                        {user.last_name}
                      </div>
                      <div class="text-[11px] font-mono text-gray-400">
                        @{user.username}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex flex-col gap-1">
                    <div
                      class="flex items-center gap-1.5 text-[11px] text-gray-600"
                    >
                      <AtSign size={12} class="text-gray-300" />
                      {user.email || "No email"}
                    </div>
                    <div
                      class="flex items-center gap-1.5 text-[11px] text-gray-600"
                    >
                      <Phone size={12} class="text-gray-300" />
                      {user.mobile || "No mobile"}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <Badge
                    class="gap-1.5 px-2.5 py-1 {user.role === 'super_admin'
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'}"
                  >
                    <Shield size={10} />
                    {user.role.replace("_", " ")}
                  </Badge>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onclick={() => openEditModal(user)}
                      class="p-2 border-none hover:text-indigo-600 hover:bg-indigo-50 shadow-none"
                      title="Edit user"
                    >
                      <Pencil size={16} />
                    </Button>
                    {#if user.role !== "super_admin" || userRole === "super_admin"}
                      <Button
                        size="sm"
                        variant="secondary"
                        onclick={() => deleteUser(user.id)}
                        class="p-2 border-none hover:text-red-600 hover:bg-red-50 shadow-none"
                        title="Remove user"
                      >
                        <Trash2 size={16} />
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}

  <!-- Modals -->
  {#if showAddUserModal}
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] transition-all p-4"
    >
      <div
        class="fixed inset-0"
        onclick={() => (showAddUserModal = false)}
        onkeydown={(e) => e.key === "Escape" && (showAddUserModal = false)}
        role="button"
        tabindex="-1"
        aria-label="Close modal"
      ></div>
      <div
        class="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200 relative z-10"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-900"
          >
            <UserRoundPlus size={24} />
          </div>
          <div>
            <h3 class="text-xl font-black text-gray-900 leading-none">
              New Account
            </h3>
            <p class="text-xs text-gray-500 mt-1">
              Configure profile and permissions for the new user.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <Input
            id="n-fname"
            label="First Name"
            bind:value={newUserFirstName}
          />
          <Input id="n-lname" label="Last Name" bind:value={newUserLastName} />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            id="n-user"
            label="Username"
            bind:value={newUserName}
            placeholder="johndoe"
          >
            {#snippet left()}
              <AtSign size={12} />
            {/snippet}
          </Input>
          <Input
            id="n-pass"
            label="Password"
            type={showNewUserPass ? "text" : "password"}
            bind:value={newUserPass}
          >
            {#snippet left()}
              <FingerprintPattern size={12} />
            {/snippet}
            {#snippet right()}
              <button
                onclick={() => (showNewUserPass = !showNewUserPass)}
                class="text-gray-300 hover:text-gray-600 p-2"
              >
                {#if showNewUserPass}<EyeOff size={16} />{:else}<Eye
                    size={16}
                  />{/if}
              </button>
            {/snippet}
          </Input>
        </div>

        <Select
          id="n-role"
          label="Assigned Permissions"
          bind:value={newUserRole}
          options={[
            { value: "super_admin", label: "Super Administrator" },
            { value: "store_admin", label: "Store Administrator" },
            { value: "merchandising", label: "Merchandising / Products" },
            { value: "ops", label: "Fulfillment / Operations" },
          ]}
        >
          {#snippet left()}
            <Lock size={12} />
          {/snippet}
        </Select>

        {#if error}
          <div
            class="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-bold text-red-600 animate-in shake-in-1 duration-200"
          >
            {error}
          </div>
        {/if}

        <div class="flex items-center gap-3 pt-2">
          <Button
            variant="primary"
            onclick={addUser}
            disabled={saving}
            class="flex-1 bg-gray-900 border-none hover:bg-black shadow-xl"
          >
            {saving ? "Creating..." : "Finalize Account"}
          </Button>
          <Button
            variant="secondary"
            onclick={() => (showAddUserModal = false)}
            class="px-6 border-none bg-gray-100 text-gray-500 hover:bg-gray-200 shadow-none"
            >Cancel</Button
          >
        </div>
      </div>
    </div>
  {/if}

  {#if showEditUserModal && editingUser}
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] transition-all p-4"
    >
      <div
        class="fixed inset-0"
        onclick={() => (showEditUserModal = false)}
        onkeydown={(e) => e.key === "Escape" && (showEditUserModal = false)}
        role="button"
        tabindex="-1"
        aria-label="Close modal"
      ></div>
      <div
        class="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200 relative z-10"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600"
          >
            <UserRoundCog size={24} />
          </div>
          <div>
            <h3 class="text-xl font-black text-gray-900 leading-none">
              Modify Profile
            </h3>
            <p class="text-xs text-gray-500 mt-1">
              Updating settings for @{editingUser.username}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <Input
            id="e-fname"
            label="First Name"
            bind:value={editingUser.first_name}
          />
          <Input
            id="e-lname"
            label="Last Name"
            bind:value={editingUser.last_name}
          />
        </div>

        <Input
          id="e-pass"
          label="Reset Password (Blank to keep)"
          type={showEditUserPass ? "text" : "password"}
          bind:value={editingUser.newPassword}
          placeholder="Enter new password..."
        >
          {#snippet right()}
            <button
              onclick={() => (showEditUserPass = !showEditUserPass)}
              class="text-gray-300 hover:text-gray-600 p-2"
            >
              {#if showEditUserPass}<EyeOff size={16} />{:else}<Eye
                  size={16}
                />{/if}
            </button>
          {/snippet}
        </Input>

        <div class="flex items-center gap-3 pt-4">
          <Button
            variant="primary"
            onclick={updateUser}
            disabled={saving}
            class="flex-1 bg-gray-900 border-none hover:bg-black shadow-xl"
          >
            {saving ? "Updating..." : "Apply Changes"}
          </Button>
          <Button
            variant="secondary"
            onclick={() => (showEditUserModal = false)}
            class="px-6 border-none bg-gray-100 text-gray-500 hover:bg-gray-200 shadow-none"
            >Discard</Button
          >
        </div>
      </div>
    </div>
  {/if}
</div>
