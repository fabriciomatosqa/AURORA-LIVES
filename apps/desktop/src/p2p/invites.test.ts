import { describe, expect, it } from 'vitest';
import { inviteMessage, readSavedInvites, saveInvite } from './invites';

const code = 'ABCDEFGHJKLMNPQR';
describe('convites locais privados', () => {
  it('salva apenas quando solicitado, com lista limitada e sem duplicatas', () => {
    const first = saveInvite([], code, 'Amigos', 1000);
    expect(first[0]).toMatchObject({ code, label: 'Amigos' });
    expect(saveInvite(first, code, 'Novo', 2000)).toEqual([{ code, label: 'Novo', savedAt: 2000 }]);
  });
  it('descarta entradas corrompidas ou antigas', () => {
    const now = 2000000000000;
    expect(readSavedInvites('{"bad":true}', now)).toEqual([]);
    expect(readSavedInvites('not-json')).toEqual([]);
    expect(readSavedInvites(JSON.stringify([{ code, savedAt: now - 31 * 86400000, label: 'Velho' }]), now)).toEqual([]);
    expect(readSavedInvites(JSON.stringify([{ code, savedAt: now, label: 'ok' }, { code, savedAt: now, label: 'duplicate' }]), now)).toHaveLength(1);
  });
  it('gera um texto pronto para WhatsApp sem criar links falsos de acesso', () => {
    const msg = inviteMessage(code);
    expect(msg).toContain('ABCD-EFGH-JKLM-NPQR');
    expect(msg).toContain('Entrar em uma sala');
    expect(() => inviteMessage('invalido')).toThrow();
  });
});
