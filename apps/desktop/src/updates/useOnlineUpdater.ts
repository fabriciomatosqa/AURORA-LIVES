import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type UpdateInfo = {
  tag: string;
  version: string;
  notes: string;
  publishedAt: string | null;
  sizeBytes: number;
};

export type UpdateCheck = {
  currentVersion: string;
  latest: UpdateInfo | null;
};

export type UpdateProgress = {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
};

export type UpdateStatus =
  | 'unsupported' | 'checking' | 'up-to-date' | 'available'
  | 'downloading' | 'downloaded' | 'installing' | 'error';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function readableError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Não foi possível completar a operação. Verifique sua conexão e tente novamente.';
}

/**
 * Native updater state shared by notification and settings UI.
 *
 * The browser preview never calls native APIs. The actual release/version/
 * checksum and executable selection are verified by the Rust backend.
 */
export function useOnlineUpdater() {
  const supported = isTauri();
  const [status, setStatus] = useState<UpdateStatus>(() => supported ? 'checking' : 'unsupported');
  const [currentVersion, setCurrentVersion] = useState('0.0.5');
  const [available, setAvailable] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress>({ downloadedBytes: 0, totalBytes: 0, percent: 0 });
  const [error, setError] = useState('');
  const running = useRef(false);
  const step = useRef<UpdateStatus>(supported ? 'checking' : 'unsupported');

  const setStep = useCallback((next: UpdateStatus) => {
    step.current = next;
    setStatus(next);
  }, []);

  const check = useCallback(async (manual = false) => {
    if (!supported || running.current || ['downloading', 'downloaded', 'installing'].includes(step.current)) return;
    running.current = true;
    setStep('checking');
    setError('');
    try {
      const result = await invoke<UpdateCheck>('check_for_updates');
      setCurrentVersion(result.currentVersion);
      setAvailable(result.latest);
      setStep(result.latest ? 'available' : 'up-to-date');
    } catch (cause) {
      if (manual) {
        setError(readableError(cause));
        setStep('error');
      } else {
        // Silent startup checks never block the app's chat or other features.
        setStep('error');
        setError('Não foi possível consultar as atualizações no momento.');
      }
    } finally {
      running.current = false;
    }
  }, [supported, setStep]);

  useEffect(() => {
    if (!supported) return;
    void check(false);
    const id = window.setInterval(() => { void check(false); }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [check, supported]);

  const download = useCallback(async () => {
    if (!supported || !available || running.current) return;
    running.current = true;
    setStep('downloading');
    setProgress({ downloadedBytes: 0, totalBytes: available.sizeBytes, percent: 0 });
    setError('');
    let stopListening: (() => void) | undefined;
    try {
      stopListening = await listen<UpdateProgress>('aurora:update-progress', event => {
        const received = event.payload;
        if (typeof received.percent === 'number' && typeof received.downloadedBytes === 'number') {
          setProgress(received);
        }
      });
      await invoke('download_update', { tag: available.tag });
      setProgress({ downloadedBytes: available.sizeBytes, totalBytes: available.sizeBytes, percent: 100 });
      setStep('downloaded');
    } catch (cause) {
      setError(readableError(cause));
      setStep('error');
    } finally {
      stopListening?.();
      running.current = false;
    }
  }, [supported, available, setStep]);

  const install = useCallback(async () => {
    if (!supported || running.current || step.current !== 'downloaded') return;
    running.current = true;
    setStep('installing');
    setError('');
    try {
      await invoke('install_update');
      // On Windows, the native command exits the app after launching the setup.
      // On Linux the OS package installer is opened and might require approval.
      setStep('downloaded');
    } catch (cause) {
      setError(readableError(cause));
      setStep('downloaded');
    } finally {
      running.current = false;
    }
  }, [supported, setStep]);

  return { supported, status, currentVersion, available, progress, error, check, download, install };
}

export type OnlineUpdater = ReturnType<typeof useOnlineUpdater>;
