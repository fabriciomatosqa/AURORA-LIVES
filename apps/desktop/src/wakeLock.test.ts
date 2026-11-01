import { describe, expect, it, vi } from 'vitest';
import { keepScreenAwakeWhileVisible } from './wakeLock';

function harness() {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' }) as unknown as Document;
  const win = new EventTarget() as unknown as Window;
  const sentinel = Object.assign(new EventTarget(), { release: vi.fn(async () => {}) });
  const request = vi.fn(async () => sentinel as unknown as WakeLockSentinel);
  const nav = { wakeLock: { request } } as unknown as Navigator;
  return { doc, win, sentinel, request, nav };
}

describe('bloqueio de tela enquanto o aplicativo está visível', () => {
  it('mantém ativa no primeiro plano e libera ao minimizar ou fechar', async () => {
    const h = harness();
    const stop = keepScreenAwakeWhileVisible(h.doc, h.nav, h.win);
    await Promise.resolve();
    expect(h.request).toHaveBeenCalledWith('screen');
    Object.assign(h.doc, { visibilityState: 'hidden' });
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(h.sentinel.release).toHaveBeenCalledTimes(1);
    Object.assign(h.doc, { visibilityState: 'visible' });
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(h.request).toHaveBeenCalledTimes(2);
    stop();
    expect(h.sentinel.release).toHaveBeenCalledTimes(2);
  });

  it('libera uma solicitação ainda pendente após desmontar', async () => {
    const h = harness();
    let resolveRequest!: (lock: WakeLockSentinel) => void;
    const nav = { wakeLock: { request: () => new Promise<WakeLockSentinel>(resolve => { resolveRequest = resolve; }) } } as unknown as Navigator;
    const stop = keepScreenAwakeWhileVisible(h.doc, nav, h.win);
    stop();
    resolveRequest(h.sentinel as unknown as WakeLockSentinel);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('não falha em webviews sem suporte à API Wake Lock', () => {
    const h = harness();
    const stop = keepScreenAwakeWhileVisible(h.doc, {} as Navigator, h.win);
    h.win.dispatchEvent(new Event('focus'));
    stop();
    expect(h.request).not.toHaveBeenCalled();
  });
});
