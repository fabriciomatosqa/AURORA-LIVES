/**
 * Ephemeral invite and wire protocol. No passwords, durable accounts or discovery listing.
 * The invite code is a high-entropy bearer capability: anyone with it can enter the room.
 */
export const ROOM_CAPACITY = 10;
export const MAX_MESSAGE_LENGTH = 2000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 unambiguous characters

export type Member = { id: string; name: string; host: boolean };
export type ChatMessage = {
  id: string;
  senderId: string;
  author: string;
  text: string;
  sentAt: number;
};
export type Wire =
  | { type: 'join'; version: 1; name: string }
  | { type: 'welcome'; version: 1; members: Member[]; messages: ChatMessage[] }
  | { type: 'members'; members: Member[] }
  | { type: 'ready' }
  | { type: 'send'; text: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'reject'; reason: 'full' | 'invalid' };

export function generateRoomCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte & 31]).join('');
}

export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== 16 || [...code].some((c) => !ALPHABET.includes(c))) return null;
  return code;
}

export function formatRoomCode(code: string): string {
  return (code.match(/.{1,4}/g) || []).join('-');
}

export function hostPeerId(code: string): string {
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new Error('Código de sala inválido.');
  return 'aurora-lives-' + normalized.toLowerCase();
}

export function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 32) || 'Visitante';
}

export function cleanText(value: string): string | null {
  const text = value.trim();
  return text.length > 0 && text.length <= MAX_MESSAGE_LENGTH ? text : null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function member(value: unknown): value is Member {
  return record(value) && typeof value.id === 'string' && value.id.length > 0
    && value.id.length < 150 && typeof value.name === 'string'
    && value.name.length > 0 && value.name.length <= 32 && typeof value.host === 'boolean';
}
function chat(value: unknown): value is ChatMessage {
  return record(value) && typeof value.id === 'string' && value.id.length > 0
    && value.id.length <= 100 && typeof value.senderId === 'string'
    && value.senderId.length > 0 && value.senderId.length < 150
    && typeof value.author === 'string' && value.author.length > 0
    && value.author.length <= 32 && typeof value.text === 'string'
    && cleanText(value.text) !== null && typeof value.sentAt === 'number' && Number.isFinite(value.sentAt);
}

/** Validate every remote payload before updating UI state. */
export function decodeWire(value: unknown): Wire | null {
  if (!record(value)) return null;
  switch (value.type) {
    case 'join':
      return value.version === 1 && typeof value.name === 'string'
        && value.name.trim().length > 0 && value.name.length <= 32
        ? { type: 'join', version: 1, name: cleanName(value.name) } : null;
    case 'ready':
      return { type: 'ready' };
    case 'send':
      return typeof value.text === 'string' && cleanText(value.text) !== null
        ? { type: 'send', text: cleanText(value.text)! } : null;
    case 'chat':
      return chat(value.message) ? { type: 'chat', message: value.message } : null;
    case 'members':
      return Array.isArray(value.members) && value.members.length <= ROOM_CAPACITY
        && value.members.every(member) ? { type: 'members', members: value.members } : null;
    case 'welcome':
      return value.version === 1 && Array.isArray(value.members)
        && value.members.length > 0 && value.members.length <= ROOM_CAPACITY
        && value.members.every(member) && Array.isArray(value.messages)
        && value.messages.length <= 100 && value.messages.every(chat)
        ? { type: 'welcome', version: 1, members: value.members, messages: value.messages } : null;
    case 'reject':
      return value.reason === 'full' || value.reason === 'invalid'
        ? { type: 'reject', reason: value.reason } : null;
    default:
      return null;
  }
}

export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const result = new Map<string, ChatMessage>();
  for (const msg of [...existing, ...incoming]) result.set(msg.id, msg);
  return [...result.values()].sort((a, b) => a.sentAt - b.sentAt).slice(-100);
}
