import { formatRoomCode, normalizeRoomCode } from './protocol';

export type SavedInvite = { code: string; label: string; savedAt: number };
export const SAVED_INVITES_KEY = 'aurora.saved-invites.v1';
export const MAX_SAVED_INVITES = 5;

export function readSavedInvites(raw: string | null, now = Date.now()): SavedInvite[] {
  if (!raw || raw.length > 5000) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const result: SavedInvite[] = [];
    for (const item of list.slice(0, 30)) {
      if (typeof item !== 'object' || !item || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const code = typeof record.code === 'string' ? normalizeRoomCode(record.code) : null;
      const timestamp = typeof record.savedAt === 'number' ? record.savedAt : NaN;
      if (!code || !Number.isFinite(timestamp) || timestamp > now + 60000) continue;
      if (now - timestamp > 30 * 24 * 60 * 60 * 1000) continue;
      if (result.some(value => value.code === code)) continue;
      result.push({
        code,
        label: typeof record.label === 'string' && record.label.trim() ?
          record.label.trim().slice(0, 40) : 'Convite ' + formatRoomCode(code),
        savedAt: timestamp,
      });
      if (result.length === MAX_SAVED_INVITES) break;
    }
    return result;
  } catch { return []; }
}

export function saveInvite(existing: SavedInvite[], code: string, label: string, now = Date.now()): SavedInvite[] {
  const normalized = normalizeRoomCode(code);
  if (!normalized) return existing;
  const name = label.trim().slice(0, 40) || 'Sala dos amigos';
  return [{ code: normalized, label: name, savedAt: now }, ...existing.filter(i => i.code !== normalized)].slice(0, MAX_SAVED_INVITES);
}

export function inviteMessage(code: string): string {
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new Error('Código de convite inválido.');
  return '🎮 Você foi convidado para uma sala no AURORA LIVES!\n\n' +
    '1. Abra o AURORA LIVES no Windows ou Linux.\n' +
    '2. Clique em "Entrar em uma sala".\n' +
    '3. Digite o código: ' + formatRoomCode(normalized) + '\n\n' +
    'Download: https://github.com/fabriciomatosqa/AURORA-LIVES/releases\n' +
    'A sala funciona enquanto o anfitrião estiver conectado. Não compartilhe o código publicamente.';
}
