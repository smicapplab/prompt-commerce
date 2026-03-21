export interface Message {
  role: 'user' | 'assistant';
  content: string;
  file?: { name: string; preview?: string };
}

let _messages = $state<Message[]>([]);
let _lastStoreSlug = $state('');

function getStorageKey(slug: string) {
  return `pc_chat_history_${slug}`;
}

function persist(slug: string) {
  if (typeof localStorage === 'undefined' || !slug) return;
  localStorage.setItem(getStorageKey(slug), JSON.stringify(_messages));
}

export const chatStore = {
  get messages() { return _messages; },

  /** Load messages for a specific store. */
  load(slug: string) {
    if (typeof localStorage === 'undefined' || !slug) {
      _messages = [];
      return;
    }
    
    // Avoid reloading if we're already on this store
    if (_lastStoreSlug === slug) return;

    const stored = localStorage.getItem(getStorageKey(slug));
    if (stored) {
      try {
        _messages = JSON.parse(stored);
      } catch {
        _messages = [];
      }
    } else {
      _messages = [];
    }
    _lastStoreSlug = slug;
  },

  addMessage(slug: string, msg: Message) {
    _messages = [..._messages, msg];
    persist(slug);
  },

  setMessages(slug: string, msgs: Message[]) {
    _messages = msgs;
    persist(slug);
  },

  clear(slug: string) {
    _messages = [];
    if (typeof localStorage !== 'undefined' && slug) {
      localStorage.removeItem(getStorageKey(slug));
    }
  }
};
