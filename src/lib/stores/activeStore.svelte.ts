/**
 * Shared reactive state for the currently selected store.
 * Persisted to localStorage so it survives page navigation.
 *
 * Usage:
 *   import { activeStore } from '$lib/stores/activeStore.svelte.js';
 *   activeStore.slug   // reactive
 *   activeStore.set(slug, id, name)
 *   activeStore.clear()
 */

let _slug = $state('');
let _id   = $state<number | null>(null);
let _name = $state('');
let _lastPath = $state('');

function persist() {
  if (typeof localStorage === 'undefined') return;
  if (_slug) {
    localStorage.setItem('pc_store_slug', _slug);
    localStorage.setItem('pc_store_id',   String(_id ?? ''));
    localStorage.setItem('pc_store_name',  _name);
    localStorage.setItem('pc_store_path',  _lastPath);
  } else {
    localStorage.removeItem('pc_store_slug');
    localStorage.removeItem('pc_store_id');
    localStorage.removeItem('pc_store_name');
    localStorage.removeItem('pc_store_path');
  }
}

export const activeStore = {
  get slug()     { return _slug; },
  get id()       { return _id;   },
  get name()     { return _name; },
  get lastPath() { return _lastPath; },

  /** Call once on layout mount to restore from localStorage. */
  hydrate() {
    if (typeof localStorage === 'undefined') return;
    _slug = localStorage.getItem('pc_store_slug') ?? '';
    _id   = Number(localStorage.getItem('pc_store_id') ?? '') || null;
    _name = localStorage.getItem('pc_store_name') ?? '';
    _lastPath = localStorage.getItem('pc_store_path') ?? '';
  },

  set(slug: string, id: number, name: string) {
    _slug = slug;
    _id   = id;
    _name = name;
    // Default to dashboard if no path is set yet
    if (!_lastPath) _lastPath = '/admin/dashboard';
    persist();
  },

  setPath(path: string) {
    _lastPath = path;
    persist();
  },

  clear() {
    _slug = '';
    _id   = null;
    _name = '';
    _lastPath = '';
    persist();
  },
};
