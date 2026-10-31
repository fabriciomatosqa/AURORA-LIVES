/** Speedtest-style non-linear dial: equal angular intervals for readable labels. */
export const SPEED_TICKS = [0, 5, 10, 50, 100, 250, 500, 750, 1000] as const;
export function gaugeFraction(speed: number | null | undefined): number {
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) return 0;
  const ticks = SPEED_TICKS;
  if (speed >= ticks[ticks.length - 1]) return 1;
  for (let i = 0; i < ticks.length - 1; i++) {
    if (speed <= ticks[i + 1]) {
      return (i + (speed - ticks[i]) / (ticks[i + 1] - ticks[i])) / (ticks.length - 1);
    }
  }
  return 1;
}
export function dialPoint(fraction: number, radius: number): { x: number; y: number } {
  const angle = (150 + Math.max(0, Math.min(1, fraction)) * 240) * Math.PI / 180;
  return { x: 160 + radius * Math.cos(angle), y: 160 + radius * Math.sin(angle) };
}
export function dialArc(fraction: number): string {
  const start = dialPoint(0, 130);
  const end = dialPoint(fraction, 130);
  return 'M ' + start.x + ' ' + start.y + ' A 130 130 0 ' +
    (fraction > 0.75 ? '1' : '0') + ' 1 ' + end.x + ' ' + end.y;
}
