import { describe, expect, it } from 'vitest';
import { isAndroidRuntime, supportsDesktopInstaller } from './platform';

describe('plataformas AURORA', () => {
  it('identifica Android em retrato e paisagem sem depender da largura da tela', () => {
    expect(isAndroidRuntime('Mozilla/5.0 (Linux; Android 16; POCO X6 Pro) AppleWebKit/537.36 Mobile')).toBe(true);
    expect(isAndroidRuntime('Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36')).toBe(true);
    expect(isAndroidRuntime('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });
  it('não oferece instalador Windows ao Android', () => {
    expect(supportsDesktopInstaller('Android 16')).toBe(false);
    expect(supportsDesktopInstaller('Windows NT 10.0')).toBe(true);
  });
});
