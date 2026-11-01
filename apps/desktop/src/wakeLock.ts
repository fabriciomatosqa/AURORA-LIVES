/**
 * Screen Wake Lock complements Android's native FLAG_KEEP_SCREEN_ON. It is
 * best-effort on desktop webviews: unsupported engines keep the OS policy.
 * Never hold a wake lock for a hidden/minimized app.
 */
export function keepScreenAwakeWhileVisible(
  doc: Document = document,
  nav: Navigator = navigator,
  win: Window = window,
): () => void {
  let disposed = false;
  let pending = false;
  let current: WakeLockSentinel | null = null;

  const release = () => {
    const held = current;
    current = null;
    if (held) void held.release().catch(() => { /* Already revoked by OS */ });
  };
  const request = async () => {
    if (disposed || pending || current || doc.visibilityState !== 'visible' || !nav.wakeLock?.request) return;
    pending = true;
    try {
      const obtained = await nav.wakeLock.request('screen');
      if (disposed || doc.visibilityState !== 'visible') {
        await obtained.release();
      } else {
        current = obtained;
        obtained.addEventListener('release', () => {
          if (current === obtained) current = null;
        }, { once: true });
      }
    } catch {
      // WebKit / low power mode / system privacy settings may reject this API.
      // Next visibility or focus event can retry. Never spin or synthesize success.
    } finally {
      pending = false;
    }
  };
  const sync = () => {
    if (doc.visibilityState !== 'visible' || disposed) release();
    else void request();
  };
  doc.addEventListener('visibilitychange', sync);
  win.addEventListener('focus', sync);
  sync();
  return () => {
    disposed = true;
    doc.removeEventListener('visibilitychange', sync);
    win.removeEventListener('focus', sync);
    release();
  };
}
