export interface Message {
  id: number;
  conversation_id: number;
  sender: string;
  sender_name: string | null;
  body: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  store: number;
  buyer_ref: string;
  buyer_name: string | null;
  channel: string;
  status: string;
  mode: string;
  assigned_to: string | null;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}
