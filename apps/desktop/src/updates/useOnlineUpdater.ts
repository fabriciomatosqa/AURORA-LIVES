import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';

export type UpdateInfo = {
  tag: string;
  version: string;
  notes: string;
  publishedAt: string | null;
  sizeBytes: number;
};
export type UpdateCheck = { currentVersion: string; latest: UpdateInfo | null };
export type UpdateProgress = { downloadedBytes: number; totalBytes: number; percent: number };
export type UpdateStatus =
  | 'unsupported' | 'checking' | 'up-to-date' | 'available'
  | 'downloading' | 'downloaded' | 'installing' | 'error';

export const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;
const REMIND_AFTER_MS = CHECK_INTERVAL_MS;
const PREVIEW_KEY = 'aurora.updates.previews';

type SnoozedRelease = { tag: string; until: number };

function storageRead(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageWrite(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Optional setting */ }
}
function readableError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Não foi possível completar a operação. Verifique sua conexão e tente novamente.';
}

/** The GitHub-only update experience. No Store, account, or server needed.
 * All integrity and installer checks remain in native Rust, not JavaScript.
 */
export function useOnlineUpdater() {
  const supported = isTauri();
  const [status, setStatus] = useState<UpdateStatus>(() => supported ? 'checking' : 'unsupported');
  const [currentVersion, setCurrentVersion] = useState('0.0.11');
  const [available, setAvailable] = useState<UpdateInfo | null>(null);
  const [includePrereleases, setPreviews] = useState(() => storageRead(PREVIEW_KEY) !== 'false');
  const [snoozed, setSnoozed] = useState<SnoozedRelease | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [progress, setProgress] = useState<UpdateProgress>({ downloadedBytes: 0, totalBytes: 0, percent: 0 });
  const [progressUnavailable, setProgressUnavailable] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const step = useRef<UpdateStatus>(supported ? 'checking' : 'unsupported');

  const setStep = useCallback((next: UpdateStatus) => {
    step.current = next;
    setStatus(next);
  }, []);

  const setIncludePrereleases = useCallback((enabled: boolean) => {
    storageWrite(PREVIEW_KEY, String(enabled));
    setPreviews(enabled);
  }, []);

  const check = useCallback(async (manual = false) => {
    if (!supported || running.current || ['downloading', 'downloaded', 'installing'].includes(step.current)) return;
    running.current = true;
    setStep('checking');
    setError('');
    try {
      const result = await invoke<UpdateCheck>('check_for_updates', { includePrereleases });
      setCurrentVersion(result.currentVersion);
      setAvailable(result.latest);
      setStep(result.latest ? 'available' : 'up-to-date');
    } catch (cause) {
      setError(manual ? readableError(cause) : 'Não foi possível consultar o GitHub agora. O aplicativo continua funcionando.');
      setStep('error');
    } finally {
      running.current = false;
    }
  }, [supported, setStep, includePrereleases]);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    void getVersion().then(version => {
      if (active) setCurrentVersion(version);
    }).catch(() => { /* The release API can still report the version. */ });
    return () => { active = false; };
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    void check(false);
    const cadence = window.setInterval(() => { void check(false); }, CHECK_INTERVAL_MS);
    const wake = window.setInterval(() => { setClock(Date.now()); }, 60 * 1000);
    return () => { window.clearInterval(cadence); window.clearInterval(wake); };
  }, [check, supported]);

  const download = useCallback(async (): Promise<boolean> => {
    if (!supported || !available || running.current) return false;
    running.current = true;
    setStep('downloading');
    setProgress({ downloadedBytes: 0, totalBytes: available.sizeBytes, percent: 0 });
    setProgressUnavailable(false);
    setError('');
    let stopListening: (() => void) | undefined;
    try {
      // If event permissions are unavailable in a legacy runtime, do not abort
      // the verified native download. Show an indeterminate progress indicator instead.
      try {
        stopListening = await listen<UpdateProgress>('aurora:update-progress', event => {
          const received = event.payload;
          if (typeof received.percent === 'number' && typeof received.downloadedBytes === 'number') {
            setProgress(received);
          }
        });
      } catch {
        setProgressUnavailable(true);
      }
      await invoke('download_update', { tag: available.tag, includePrereleases });
      setProgress({ downloadedBytes: available.sizeBytes, totalBytes: available.sizeBytes, percent: 100 });
      setStep('downloaded');
      return true;
    } catch (cause) {
      const text = readableError(cause);
      if (text.toLocaleLowerCase('pt-BR').includes('cancelado')) {
        setStep('available');
        setError('');
      } else {
        setError(text);
        setStep('error');
      }
      return false;
    } finally {
      stopListening?.();
      running.current = false;
    }
  }, [supported, available, includePrereleases, setStep]);

  const cancel = useCallback(async () => {
    if (!supported || step.current !== 'downloading') return;
    try {
      await invoke('cancel_update_download');
    } catch (cause) {
      setError(readableError(cause));
    }
  }, [supported]);

  const install = useCallback(async (): Promise<boolean> => {
    if (!supported || running.current || step.current !== 'downloaded') return false;
    running.current = true;
    setStep('installing');
    setError('');
    try {
      // Both desktop platforms launch the validated installer then exit.
      // The installer runs independently from this process.
      await invoke('install_update');
      return true;
    } catch (cause) {
      setError(readableError(cause));
      setStep('downloaded');
      return false;
    } finally {
      running.current = false;
    }
  }, [supported, setStep]);

  // One explicit click triggers download, SHA-256 validation and installation.
  // Active calls may be disconnected because the app exits during installation.
  const updateNow = useCallback(async () => {
    if (await download()) await install();
  }, [download, install]);

  const snooze = useCallback(() => {
    if (!available) return;
    const choice = { tag: available.tag, until: Date.now() + REMIND_AFTER_MS };
    setSnoozed(choice);
    // An app restart always checks and offers the update again.
  }, [available]);

  const notificationVisible = supported && status === 'available' && Boolean(available) &&
    (!snoozed || snoozed.tag !== available?.tag || snoozed.until <= clock);

  return {
    supported, status, currentVersion, available, progress, progressUnavailable, error,
    includePrereleases, setIncludePrereleases,
    notificationVisible, snooze, check, download, cancel, install, updateNow
  };
}

export type OnlineUpdater = ReturnType<typeof useOnlineUpdater>;
