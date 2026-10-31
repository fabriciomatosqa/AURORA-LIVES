/** Five local rows, each containing ONLY download, upload and ping. */
export const KEY = 'aurora.connection.speed-history.v1';
export type SpeedRow = { downloadMbps: number; uploadMbps: number; pingMs: number };
export type SpeedResult = SpeedRow & { jitterMs: number; publicIp: string | null };
function valid(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1_000_000; }
export function readHistory(input: string | null): SpeedRow[] {
  try {
    const decoded: unknown = JSON.parse(input || '[]');
    if (!Array.isArray(decoded)) return [];
    const result: SpeedRow[] = [];
    for (const item of decoded) {
      if (!item || typeof item !== 'object') continue;
      const v = item as Record<string, unknown>;
      if (valid(v.downloadMbps) && valid(v.uploadMbps) && valid(v.pingMs)) {
        result.push({ downloadMbps: v.downloadMbps, uploadMbps: v.uploadMbps, pingMs: v.pingMs });
      }
      if (result.length === 5) break;
    }
    return result;
  } catch { return []; }
}
export function addHistory(history: SpeedRow[], result: SpeedRow): SpeedRow[] {
  return readHistory(JSON.stringify([result, ...history]));
}
export function quality(s: SpeedResult): 'Excelente' | 'Boa' | 'Regular' | 'Ruim' {
  if (s.pingMs < 30 && s.jitterMs < 10 && s.downloadMbps >= 50 && s.uploadMbps >= 10) return 'Excelente';
  if (s.pingMs < 60 && s.jitterMs < 20 && s.downloadMbps >= 15 && s.uploadMbps >= 4) return 'Boa';
  if (s.pingMs < 100 && s.jitterMs < 35 && s.downloadMbps >= 5 && s.uploadMbps >= 1) return 'Regular';
  return 'Ruim';
}
export function number(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—';
}
