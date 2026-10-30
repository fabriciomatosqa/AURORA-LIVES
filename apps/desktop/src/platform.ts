/** Platform capability detection lives outside the P2P protocol. */
export function isAndroidRuntime(agent?: string): boolean {
  const value = agent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent);
  return /Android/i.test(value);
}

/** Desktop-only installers must not be executed by Android's WebView. */
export function supportsDesktopInstaller(agent?: string): boolean {
  return !isAndroidRuntime(agent);
}
