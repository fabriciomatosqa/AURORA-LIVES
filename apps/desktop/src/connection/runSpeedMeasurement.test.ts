import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEASUREMENT_DEADLINE_MS, runSpeedMeasurement, type SpeedProgress } from './runSpeedMeasurement';

const value = { downloadMbps: 50, uploadMbps: 10, pingMs: 8, jitterMs: 2, publicIp: null };
const sample: SpeedProgress = { ...value, phase: 'download' };
afterEach(() => vi.useRealTimers());

describe('ciclo da medição nativa', () => {
  it('registra os eventos antes de iniciar e limpa o listener ao concluir', async () => {
    const order: string[] = [];
    const cleanup = vi.fn(); const progress = vi.fn();
    const result = await runSpeedMeasurement({
      listen: async listener => { order.push('listen'); listener(sample); return cleanup; },
      invoke: async () => { order.push('invoke'); return value; },
    }, progress);
    expect(result).toEqual(value); expect(order).toEqual(['listen', 'invoke']);
    expect(progress).toHaveBeenCalledWith(sample); expect(cleanup).toHaveBeenCalledOnce();
  });
  it('encerra a espera se o comando Rust nunca responder e ignora eventos atrasados', async () => {
    vi.useFakeTimers(); const cleanup = vi.fn(); const progress = vi.fn();
    let listener!: (p: SpeedProgress) => void;
    const result = runSpeedMeasurement({
      listen: async cb => { listener = cb; return cleanup; },
      invoke: () => new Promise(() => {}),
    }, progress);
    const assertion = expect(result).rejects.toThrow('tempo permitido');
    await vi.advanceTimersByTimeAsync(MEASUREMENT_DEADLINE_MS);
    await assertion; listener(sample);
    expect(progress).not.toHaveBeenCalled(); expect(cleanup).toHaveBeenCalledOnce();
  });
  it('encerra também a inscrição IPC travada, sem iniciar uma medição atrasada', async () => {
    vi.useFakeTimers(); const invoke = vi.fn(); const cleanup = vi.fn();
    let subscribed!: (fn: () => void) => void;
    const result = runSpeedMeasurement({listen: () => new Promise(resolve => { subscribed = resolve; }), invoke}, vi.fn());
    const assertion = expect(result).rejects.toThrow('tempo permitido');
    await vi.advanceTimersByTimeAsync(MEASUREMENT_DEADLINE_MS); await assertion;
    subscribed(cleanup); await Promise.resolve();
    expect(invoke).not.toHaveBeenCalled(); expect(cleanup).toHaveBeenCalledOnce();
  });
  it('propaga falhas nativas e remove a inscrição', async () => {
    const cleanup = vi.fn();
    await expect(runSpeedMeasurement({listen: async () => cleanup, invoke: async () => { throw new Error('M-Lab indisponível'); }}, vi.fn()))
      .rejects.toThrow('M-Lab indisponível');
    expect(cleanup).toHaveBeenCalledOnce();
  });
  it('recusa resultados inválidos e limpa o listener', async () => {
    const cleanup = vi.fn();
    await expect(runSpeedMeasurement({listen: async () => cleanup, invoke: async () => ({...value, downloadMbps: NaN})}, vi.fn()))
      .rejects.toThrow('valores inválidos');
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
