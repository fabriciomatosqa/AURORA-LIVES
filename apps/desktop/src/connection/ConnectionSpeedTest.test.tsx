import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConnectionSpeedTest } from './ConnectionSpeedTest';
import { addHistory, readHistory, quality } from './speedHistory';
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
  it('mostra somente download, upload e ping no histórico', () => {
    const html = renderToStaticMarkup(<ConnectionSpeedTest/>);
    expect(html).toContain('Teste de conexão');
    expect(html).toContain('Medir agora');
    expect(html).toContain('Últimas 5 medições');
    expect(html).toContain('Histórico de download, upload e ping');
    expect(html).toContain('IP público');
    expect(html).toContain('Measurement Lab');
    expect(html).toContain('servidor automático');
    expect(html).toContain('Autorizo esta medição do Measurement Lab');
    expect(html).toContain('incluindo meu IP público e o horário do teste');
    expect(html).toContain('Ping TCP (M-Lab)');
    expect(html).toContain('Jitter TCP (M-Lab)');
    expect(html).not.toContain('Cloudflare');
  });
});
