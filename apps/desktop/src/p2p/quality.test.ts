import { describe, expect, it } from 'vitest';
import { actualVideoRtp, capabilities, capturePreset, summarizeRTCStats } from './quality';

describe('qualidade automática em malha P2P', () => {
  it('prioriza 1080p60 em salas pequenas, adaptando antes de sobrecarregar o upload', () => {
    expect(capturePreset('auto', 2)).toMatchObject({ width: 1920, fps: 60 });
    expect(capturePreset('auto', 3)).toMatchObject({ width: 1280, height: 720, fps: 60 });
    expect(capturePreset('fluid', 9)).toMatchObject({ width: 1280, height: 720, fps: 60 });
    expect(capturePreset('high', 9)).toMatchObject({ width: 1920, fps: 30 });
    expect(capturePreset('auto', 5)).toMatchObject({ width: 1280, fps: 30 });
    expect(capturePreset('auto', 9)).toMatchObject({ width: 854, fps: 30 });
    expect(capturePreset('ultra', 10)).toMatchObject({ width: 1920, fps: 60 });
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
  it('registra FPS RTP entregue, não o valor solicitado na captura', () => {
    const rtp = new Map([
      ['out', { type: 'outbound-rtp', kind: 'video', frameWidth: 1280,
        frameHeight: 720, framesPerSecond: 57.4 }],
    ]);
    expect(actualVideoRtp(rtp as unknown as RTCStatsReport, 'outbound-rtp'))
      .toMatchObject({ videoWidth: 1280, videoHeight: 720, videoFps: 57.4, videoDirection: 'outbound-rtp' });
    expect(summarizeRTCStats(new Map() as unknown as RTCStatsReport, 'connected',
      rtp as unknown as RTCStatsReport)).toMatchObject({ videoWidth: 1280, videoFps: 57.4 });
    expect(actualVideoRtp(new Map() as unknown as RTCStatsReport, 'outbound-rtp'))
      .toMatchObject({ videoWidth: null, videoFps: null, videoDirection: null });
    expect(actualVideoRtp(new Map([
      ['in', { type: 'inbound-rtp', kind: 'video', frameWidth: 854,
        frameHeight: 480, framesPerSecond: 29 }],
    ]) as unknown as RTCStatsReport, 'inbound-rtp')).toMatchObject({
      videoWidth: 854, videoHeight: 480, videoFps: 29,
    });
  });
  it('reporta recursos do navegador de forma verificável', () => {
    const report = capabilities();
    expect(typeof report.webRTC).toBe('boolean');
    expect(typeof report.screenApi).toBe('boolean');
    expect(typeof report.pictureInPicture).toBe('boolean');
  });
});
