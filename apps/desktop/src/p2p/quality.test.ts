import { describe, expect, it } from 'vitest';
import { CAPTURE_PRESETS, capabilities, capturePreset, preferVideoMotion, summarizeRTCStats } from './quality';

describe('qualidade automática em malha P2P', () => {
  it('preserva todos os cinco perfis e adiciona Fluidez 720p60', () => {
    expect(CAPTURE_PRESETS.economy).toMatchObject({ width: 854, height: 480, fps: 30, priority: 'Poupar internet' });
    expect(CAPTURE_PRESETS.balanced).toMatchObject({ width: 1280, height: 720, fps: 30, priority: 'Estabilidade' });
    expect(CAPTURE_PRESETS.fluid).toMatchObject({ width: 1280, height: 720, fps: 60, priority: 'Movimento suave' });
    expect(CAPTURE_PRESETS.high).toMatchObject({ width: 1920, height: 1080, fps: 30, priority: 'Nitidez' });
    expect(CAPTURE_PRESETS.ultra).toMatchObject({ width: 1920, height: 1080, fps: 60, priority: 'Nitidez e fluidez' });
    expect(Object.keys(CAPTURE_PRESETS)).toHaveLength(5);
    expect(capturePreset('fluid', 10)).toBe(CAPTURE_PRESETS.fluid); // escolha manual respeitada
  });

  it('ajusta automático pelo número de participantes e preserva 60 FPS quando viável', () => {
    expect(capturePreset('auto', 2)).toBe(CAPTURE_PRESETS.ultra);
    expect(capturePreset('auto', 3)).toBe(CAPTURE_PRESETS.fluid);
    expect(capturePreset('auto', 5)).toBe(CAPTURE_PRESETS.balanced);
    expect(capturePreset('auto', 9)).toBe(CAPTURE_PRESETS.economy);
  });

  it('reduz automaticamente a qualidade quando a conexão medida é limitada', () => {
    expect(capturePreset('auto', 2, { state: 'connected', rttMs: 40, estimatedUplinkMbps: 4.2 }))
      .toBe(CAPTURE_PRESETS.fluid);
    expect(capturePreset('auto', 2, { state: 'connected', rttMs: 40, estimatedUplinkMbps: 2.5 }))
      .toBe(CAPTURE_PRESETS.balanced);
    expect(capturePreset('auto', 2, { state: 'connected', rttMs: 500, estimatedUplinkMbps: 40 }))
      .toBe(CAPTURE_PRESETS.economy);
    expect(capturePreset('auto', 3, { state: 'connected', rttMs: 20, estimatedUplinkMbps: 50 }))
      .toBe(CAPTURE_PRESETS.fluid); // uma medição isolada não remove o limite da malha
    expect(capturePreset('fluid', 9, { state: 'unstable', rttMs: 900, estimatedUplinkMbps: 0.1 }))
      .toBe(CAPTURE_PRESETS.fluid); // escolha manual não é sobrescrita
  });

  it('prioriza movimento a 60 FPS sem impedir fallback em WebViews', () => {
    const track = { contentHint: '' } as unknown as MediaStreamTrack;
    preferVideoMotion(track, CAPTURE_PRESETS.fluid);
    expect(track.contentHint).toBe('motion');
    preferVideoMotion(track, CAPTURE_PRESETS.high);
    expect(track.contentHint).toBe('detail');
  });
  it('exibe RTT e estimativa de banda somente quando métricas válidas existem', () => {
    const map = new Map<string, Record<string, unknown>>([
      ['transport', { id: 'transport', type: 'transport', selectedCandidatePairId: 'pair' }],
      ['pair', { id: 'pair', type: 'candidate-pair', currentRoundTripTime: 0.057, availableOutgoingBitrate: 4200000, remoteCandidateId: 'remote' }],
      ['remote', { id: 'remote', type: 'remote-candidate', candidateType: 'srflx' }],
    ]);
    const result = summarizeRTCStats(map as unknown as RTCStatsReport, 'connected');
    expect(result).toMatchObject({ state: 'connected', rttMs: 57, estimatedUplinkMbps: 4.2, direct: true });
  });
  it('não inventa ping nem bitrate onde não há dados de ICE', () => {
    const result = summarizeRTCStats(new Map() as unknown as RTCStatsReport, 'failed');
    expect(result).toMatchObject({ state: 'unavailable', rttMs: null, estimatedUplinkMbps: null, direct: null });
  });
  it('identifica rede instável sem tratar estimativas como testes de velocidade', () => {
    const map = new Map([['pair', { id: 'pair', type: 'candidate-pair', nominated: true, state: 'succeeded', currentRoundTripTime: .8 }]]);
    const result = summarizeRTCStats(map as unknown as RTCStatsReport, 'connected');
    expect(result.state).toBe('unstable');
    expect(result.rttMs).toBe(800);
  });
  it('reporta recursos do navegador de forma verificável', () => {
    const report = capabilities();
    expect(typeof report.webRTC).toBe('boolean');
    expect(typeof report.screenApi).toBe('boolean');
    expect(typeof report.pictureInPicture).toBe('boolean');
  });
});
