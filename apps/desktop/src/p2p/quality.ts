/**
 * Capture profiles are upper bounds / hints, not delivery guarantees.
 * Mesh calls send one independent stream to each viewer; prefer lower
 * resolution as the room grows so one person's upload is not overwhelmed.
 */
export type QualityMode = 'auto' | 'economy' | 'balanced' | 'fluid' | 'high' | 'ultra';

export type CapturePreset = {
  name: string;
  width: number;
  height: number;
  fps: number;
  priority: string;
};

export const CAPTURE_PRESETS: Record<Exclude<QualityMode, 'auto'>, CapturePreset> = {
  economy: { name: 'Econômico · 480p30', width: 854, height: 480, fps: 30, priority: 'Poupar internet' },
  balanced: { name: 'Equilibrado · 720p30', width: 1280, height: 720, fps: 30, priority: 'Estabilidade' },
  fluid: { name: 'Fluidez · 720p60', width: 1280, height: 720, fps: 60, priority: 'Movimento suave' },
  high: { name: 'Alta definição · 1080p30', width: 1920, height: 1080, fps: 30, priority: 'Nitidez' },
  ultra: { name: 'Ultra · 1080p60', width: 1920, height: 1080, fps: 60, priority: 'Nitidez e fluidez' },
};

/**
 * Adaptive selection uses both mesh upload pressure (number of recipients) and
 * available ICE candidate-pair measurements when provided. This is a cautious
 * hint, not a bandwidth test or a promise of delivered frame rate.
 * For missing metrics, retain the safe participant-count fallback.
 */
export type AdaptationSample = {
  rttMs: number | null;
  estimatedUplinkMbps: number | null;
  state: 'unavailable' | 'connecting' | 'connected' | 'unstable';
};

const AUTO_ORDER = ['economy', 'balanced', 'fluid', 'high', 'ultra'] as const;

export function capturePreset(
  mode: QualityMode,
  participantCount: number,
  sample?: AdaptationSample,
): CapturePreset {
  if (mode !== 'auto') return CAPTURE_PRESETS[mode];
  const byParticipants = participantCount >= 7 ? 0 : participantCount >= 4 ? 1 : participantCount >= 3 ? 2 : 4;
  // A single selected ICE pair isn't an aggregate upload measurement. Use it
  // only as a downshift hint, never to exceed the participants' safety cap.
  let byNetwork = 4;
  if (sample?.state === 'unstable' || (sample?.rttMs !== null && sample?.rttMs !== undefined && sample.rttMs > 450)) {
    byNetwork = 0;
  } else if (sample?.rttMs !== null && sample?.rttMs !== undefined && sample.rttMs > 250) {
    byNetwork = 1;
  }
  if (sample?.estimatedUplinkMbps !== null && sample?.estimatedUplinkMbps !== undefined
      && Number.isFinite(sample.estimatedUplinkMbps)) {
    const mbps = sample.estimatedUplinkMbps;
    // Conservative per-connection estimates, never an exact bandwidth budget.
    const byBitrate = mbps < 2 ? 0 : mbps < 3.5 ? 1 : mbps < 5 ? 2 : mbps < 8 ? 3 : 4;
    byNetwork = Math.min(byNetwork, byBitrate);
  }
  return CAPTURE_PRESETS[AUTO_ORDER[Math.min(byParticipants, byNetwork)]];
}

/** A browser may ignore contentHint. For 60 FPS request fluid motion over detail. */
export function preferVideoMotion(track: MediaStreamTrack, preset: CapturePreset): void {
  try {
    track.contentHint = preset.fps >= 60 ? 'motion' : 'detail';
  } catch {
    // Native webviews may not allow this hint; capture remains functional.
  }
}

/** ICE candidate pair statistics are measurements only, not a speed test. */
export type NetworkMetrics = {
  state: 'unavailable' | 'connecting' | 'connected' | 'unstable';
  rttMs: number | null;
  estimatedUplinkMbps: number | null;
  direct: boolean | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoFps: number | null;
};

export const emptyMetrics: NetworkMetrics = {
  state: 'unavailable', rttMs: null, estimatedUplinkMbps: null,
  direct: null, videoWidth: null, videoHeight: null, videoFps: null,
};

/** Use the selected candidate pair, not an arbitrary pair from getStats(). */
export function summarizeRTCStats(
  stats: RTCStatsReport,
  connectionState: RTCPeerConnectionState,
  capture?: MediaStreamTrack | null,
): NetworkMetrics {
  let selected: Record<string, unknown> | null = null;
  let remoteCandidate: Record<string, unknown> | null = null;
  let activeTransportPair: string | null = null;

  stats.forEach((entry) => {
    const record = entry as unknown as Record<string, unknown>;
    if (entry.type === 'transport' && typeof record.selectedCandidatePairId === 'string') {
      activeTransportPair = record.selectedCandidatePairId;
    }
  });
  stats.forEach((entry: RTCStats) => {
    const record = entry as unknown as Record<string, unknown>;
    if (entry.type === 'candidate-pair' && (
      entry.id === activeTransportPair
      || (!activeTransportPair && record.nominated === true && record.state === 'succeeded')
    )) {
      selected = record;
      const id = record.remoteCandidateId;
      if (typeof id === 'string') {
        remoteCandidate = stats.get(id) as unknown as Record<string, unknown> | null;
      }
    }
  });
  const pair = selected as Record<string, unknown> | null;
  const remote = remoteCandidate as Record<string, unknown> | null;
  const rtt = pair && typeof pair.currentRoundTripTime === 'number'
    ? Math.round(Math.max(0, pair.currentRoundTripTime) * 1000) : null;
  const available = pair && typeof pair.availableOutgoingBitrate === 'number'
    ? Math.round(Math.max(0, pair.availableOutgoingBitrate) / 100000) / 10 : null;
  // Without TURN, a 'relay' candidate would still need to be reported honestly.
  const candidateType = remote && typeof remote.candidateType === 'string' ? remote.candidateType : null;
  const settings = capture?.getSettings();
  return {
    state: connectionState === 'connected'
      ? (rtt !== null && rtt > 500 ? 'unstable' : 'connected')
      : connectionState === 'connecting' || connectionState === 'new'
        ? 'connecting' : 'unavailable',
    rttMs: rtt,
    estimatedUplinkMbps: available,
    direct: candidateType ? candidateType !== 'relay' : null,
    videoWidth: settings?.width ?? null,
    videoHeight: settings?.height ?? null,
    videoFps: settings?.frameRate ?? null,
  };
}

export type CapabilityReport = {
  webRTC: boolean;
  microphoneApi: boolean;
  screenApi: boolean;
  pictureInPicture: boolean;
  secureContext: boolean;
};

export function capabilities(): CapabilityReport {
  return {
    webRTC: typeof RTCPeerConnection !== 'undefined',
    microphoneApi: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    screenApi: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia,
    pictureInPicture: typeof document !== 'undefined' && 'pictureInPictureEnabled' in document
      && document.pictureInPictureEnabled,
    secureContext: typeof isSecureContext === 'boolean' ? isSecureContext : false,
  };
}
