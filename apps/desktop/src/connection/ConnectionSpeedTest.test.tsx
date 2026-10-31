import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConnectionSpeedTest } from './ConnectionSpeedTest';
import { addHistory, readHistory, quality } from './speedHistory';
import { SPEED_TICKS, dialArc, dialPoint, gaugeFraction } from './speedGauge';

describe('medição e histórico local de rede', () => {
  const measurement = (v: number) => ({ downloadMbps: v, uploadMbps: v / 2, pingMs: 10 + v });
  it('armazena no máximo cinco medições, apenas as três métricas solicitadas', () => {
    const h = Array.from({ length: 8 }, (_, i) => i).reduce((old, i) => addHistory(old, measurement(i)), [] as ReturnType<typeof measurement>[]);
    expect(h).toHaveLength(5);
    expect(h[0]).toEqual(measurement(7));
    expect(h[4]).toEqual(measurement(3));
    expect(Object.keys(h[0]).sort()).toEqual(['downloadMbps', 'pingMs', 'uploadMbps']);
  });
  it('limpa campos extras do histórico e descarta dados inválidos', () => {
    expect(readHistory('{broken')).toEqual([]);
    expect(readHistory(JSON.stringify([{ ...measurement(2), publicIp: '1.2.3.4', jitterMs: 5 }, { downloadMbps: -2, uploadMbps: 4, pingMs: 5 }]))).toEqual([measurement(2)]);
  });
  it('classifica resultados pelas quatro métricas', () => {
    const q = (d: number, u: number, p: number, j: number) => quality({ downloadMbps: d, uploadMbps: u, pingMs: p, jitterMs: j, publicIp: null });
    expect(q(70, 20, 18, 4)).toBe('Excelente');
    expect(q(20, 5, 35, 13)).toBe('Boa');
    expect(q(7, 2, 70, 26)).toBe('Regular');
    expect(q(1, 0.2, 150, 50)).toBe('Ruim');
  });
  it('exibe velocímetro real sem exigir checkbox antes de iniciar', () => {
    const html = renderToStaticMarkup(<ConnectionSpeedTest/>);
    expect(html).toContain('Teste de conexão');
    expect(html).toContain('Medir agora');
    expect(html).toContain('Velocímetro');
    expect(html).toContain('Pronto para medir');
    expect(html).toContain('Últimas 5 medições');
    expect(html).toContain('Histórico de download, upload e ping');
    expect(html).toContain('IP público');
    expect(html).toContain('Measurement Lab');
    expect(html).toContain('servidor automático');
    expect(html).toContain('Ao tocar em');
    expect(html).toContain('publica IP público');
    expect(html).not.toContain('Autorizo esta medição');
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain('Ping TCP (M-Lab)');
    expect(html).toContain('Jitter TCP (M-Lab)');
    expect(html).not.toContain('Cloudflare');
  });
  it('calibra a agulha segundo todas as marcas e limita valores extremos', () => {
    expect(SPEED_TICKS).toEqual([0, 5, 10, 50, 100, 250, 500, 750, 1000]);
    expect(gaugeFraction(50)).toBe(3 / 8);
    expect(gaugeFraction(100)).toBe(0.5);
    expect(gaugeFraction(1000)).toBe(1);
    expect(gaugeFraction(1200)).toBe(1);
    expect(gaugeFraction(-1)).toBe(0);
    expect(gaugeFraction(null)).toBe(0);
    expect(gaugeFraction(NaN)).toBe(0);
    expect(dialArc(1)).toContain('A 130 130 0 1 1');
    expect(dialPoint(0, 92).x).toBeLessThan(160);
    expect(dialPoint(1, 92).x).toBeGreaterThan(160);
  });
});
