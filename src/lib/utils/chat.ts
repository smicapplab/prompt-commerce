import { 
  Send as SendIcon, 
  MessageCircle, 
  Mail 
} from '@lucide/svelte';

/**
 * Returns the appropriate icon component for a chat channel
 * @param ch Channel name (e.g. 'telegram', 'whatsapp')
 */
export function channelIcon(ch: string) {
  if (ch === 'telegram') return SendIcon;
  if (ch === 'whatsapp') return MessageCircle;
  return Mail;
}
