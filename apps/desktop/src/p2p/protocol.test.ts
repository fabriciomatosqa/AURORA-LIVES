import { describe, expect, it } from 'vitest';
import { cleanName, cleanText, decodeWire, formatRoomCode, generateRoomCode, hostPeerId, isNameTaken, mergeMessages, normalizeRoomCode, normalizedName, validDisplayName } from './protocol';

describe('convites e identificação', () => {
  it('gera códigos secretos de 16 caracteres e formato legível', () => {
    const codes = new Set(Array.from({ length: 64 }, () => generateRoomCode()));
    expect(codes.size).toBe(64);
    for (const code of codes) {
      expect(normalizeRoomCode(code)).toBe(code);
      expect(formatRoomCode(code)).toMatch(/^([A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}$/);
      expect(hostPeerId(code)).toBe('aurora-lives-' + code.toLowerCase());
    }
  });
  it('permite inserir código com ou sem traços e rejeita códigos incorretos', () => {
    expect(normalizeRoomCode('ABCD-EFGH-JKLM-NPQR')).toBe('ABCDEFGHJKLMNPQR');
    expect(normalizeRoomCode('abcd efgh jklm npqr')).toBe('ABCDEFGHJKLMNPQR');
    expect(normalizeRoomCode('ABCD-EFGH-JKLM-NP0R')).toBeNull();
    expect(normalizeRoomCode('../etc/passwd')).toBeNull();
    expect(() => hostPeerId('ABCD')).toThrow();
  });
});

describe('mensagens de terceiros', () => {
  it('só aceita mensagens dentro do limite e de autores válidos', () => {
    expect(cleanName('  Ana   Maria  ')).toBe('Ana Maria');
    expect(cleanName('   ')).toBe('');
    expect(cleanText('  Olá  ')).toBe('Olá');
    expect(cleanText('')).toBeNull();
    expect(cleanText('x'.repeat(2001))).toBeNull();
    expect(decodeWire({ type: 'send', text: ' oi ' })).toEqual({ type: 'send', text: 'oi' });
    expect(decodeWire({ type: 'join', name: 'Ana', version: 1 })).toMatchObject({ name: 'Ana' });
    expect(decodeWire({ type: 'join', name: '', version: 1 })).toBeNull();
    expect(decodeWire({ type: 'join', name: 'Visitante', version: 1 })).toBeNull();
    expect(decodeWire({ type: 'join', name: ' VISITANTE ', version: 1 })).toBeNull();
    expect(decodeWire({ type: 'send', text: '<script>alert(1)</script>' })?.type).toBe('send');
    expect(decodeWire({ type: 'send', text: 'x'.repeat(4000) })).toBeNull();
  });
  it('exige nome próprio e recusa duplicidade com variação de caixa e acento', () => {
    expect(validDisplayName('')).toBe(false);
    expect(validDisplayName('   ')).toBe(false);
    expect(validDisplayName('Visitante')).toBe(false);
    expect(validDisplayName('  vIsItAnTe  ')).toBe(false);
    expect(validDisplayName('Visitánte')).toBe(false);
    expect(validDisplayName('Beatriz')).toBe(true);
    expect(validDisplayName('a'.repeat(33))).toBe(false);
    expect(normalizedName(' ANA   MARIA ')).toBe(normalizedName('Ana Maria'));
    const members = [{ id: 'host', name: 'Ana Maria', host: true }];
    expect(isNameTaken('aNA   MARIA', members)).toBe(true);
    expect(isNameTaken('Ana Maria', members, 'host')).toBe(false);
    expect(isNameTaken('Bia', members)).toBe(false);
    expect(decodeWire({ type: 'reject', reason: 'name-taken' })).toEqual({ type: 'reject', reason: 'name-taken' });
  });
  it('rejeita objetos inesperados ou snapshots de tamanho excessivo', () => {
    expect(decodeWire(null)).toBeNull();
    expect(decodeWire({ type: '__proto__' })).toBeNull();
    expect(decodeWire({ type: 'welcome', members: [], messages: [], version: 1 })).toBeNull();
    expect(decodeWire({ type: 'members', members: new Array(11).fill({ id: 'a', name: 'A', host: false }) })).toBeNull();
    expect(decodeWire({ type: 'chat', message: { id: '1' } })).toBeNull();
  });
  it('deduplica o histórico ao receber eco do anfitrião', () => {
    const message = { id: '1', senderId: 'peer1', author: 'Ana', text: 'Olá', sentAt: 1 };
    expect(mergeMessages([message], [message])).toEqual([message]);
  });
});
