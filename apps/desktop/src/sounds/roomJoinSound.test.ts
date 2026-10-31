import { describe, expect, it } from 'vitest';
import { hasNewRemoteMember } from './roomJoinSound';
import type { RoomSnapshot } from '../p2p/session';

type Presence = Pick<RoomSnapshot, 'phase' | 'code' | 'localId' | 'members'>;
const host = { id: 'host', name: 'Ana', host: true };
const guestA = { id: 'guestA', name: 'Bia', host: false };
const guestB = { id: 'guestB', name: 'Caio', host: false };
const room = (members: Presence['members'], options: Partial<Presence> = {}): Presence => ({
  phase: 'connected', code: 'ABCD1234ABCD1234', localId: 'host', members, ...options
});

describe('efeito de entrada AURORA', () => {
  it('soa quando uma nova pessoa entra na sala do anfitrião', () => {
    expect(hasNewRemoteMember(room([host]), room([host, guestA]))).toBe(true);
  });

  it('soa para quem já está na sala quando outra pessoa chega', () => {
    const before = room([host, guestA], { localId: 'guestA' });
    const after = room([host, guestA, guestB], { localId: 'guestA' });
    expect(hasNewRemoteMember(before, after)).toBe(true);
  });

  it('não soa ao receber a lista inicial ou quando o próprio usuário entra', () => {
    expect(hasNewRemoteMember(room([], { phase: 'connecting', localId: 'guestA' }),
      room([host, guestA], { localId: 'guestA' }))).toBe(false);
  });

  it('não soa para atualizações repetidas, saída ou reconexão', () => {
    expect(hasNewRemoteMember(room([host, guestA]), room([host, guestA]))).toBe(false);
    expect(hasNewRemoteMember(room([host, guestA]), room([host]))).toBe(false);
    expect(hasNewRemoteMember(room([host, guestA], { phase: 'reconnecting' }),
      room([host, guestA, guestB]))).toBe(false);
    expect(hasNewRemoteMember(room([host]), room([host, guestB], { code: 'OTHER12345678901' }))).toBe(false);
  });
});
