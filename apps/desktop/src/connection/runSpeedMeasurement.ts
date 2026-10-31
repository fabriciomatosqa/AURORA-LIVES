import type { SpeedResult } from './speedHistory';

export type SpeedProgress = {
  phase: string;
  downloadMbps: number | null;
  uploadMbps: number | null;
  pingMs: number | null;
  jitterMs: number | null;
  publicIp: string | null;
};
export const MEASUREMENT_DEADLINE_MS = 100_000;

type Transport = {
  listen: (onProgress: (progress: SpeedProgress) => void) => Promise<() => void>;
  invoke: () => Promise<SpeedResult>;
};

/** Bound BOTH IPC subscription and execution. Late replies cannot update a new run. */
export function runSpeedMeasurement(transport: Transport, onProgress: (progress: SpeedProgress) => void): Promise<SpeedResult> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let unlisten: (() => void) | undefined;
    const cleanup = () => {
      try { unlisten?.(); } catch { /* Native listener may already have been removed. */ }
      unlisten = undefined;
    };
    const finish = (result?: SpeedResult, error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      if (error !== undefined) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(() => finish(undefined, new Error(
      'O teste M-Lab não respondeu dentro do tempo permitido. Verifique a conexão e tente novamente.'
    )), MEASUREMENT_DEADLINE_MS);
    void (async () => {
      unlisten = await transport.listen(progress => { if (!finished) onProgress(progress); });
      if (finished) { cleanup(); return; }
      const result = await transport.invoke();
      if ([result.downloadMbps, result.uploadMbps, result.pingMs, result.jitterMs].some(
        n => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) {
        throw new Error('A medição retornou valores inválidos.');
      }
      finish(result);
    })().catch(error => finish(undefined, error));
  });
}
