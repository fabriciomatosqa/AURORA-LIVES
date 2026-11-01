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
};

export const CAPTURE_PRESETS: Record<Exclude<QualityMode, 'auto'>, CapturePreset> = {
  economy: { name: 'Econômico · 480p30', width: 854, height: 480, fps: 30 },
  balanced: { name: 'Equilibrado · 720p30', width: 1280, height: 720, fps: 30 },
  fluid: { name: 'Fluidez · 720p60', width: 1280, height: 720, fps: 60 },
  high: { name: 'Alta qualidade · 1080p30', width: 1920, height: 1080, fps: 30 },
  ultra: { name: 'Máxima qualidade · 1080p60', width: 1920, height: 1080, fps: 60 },
};

/** Under congestion, `motion` asks WebRTC to preserve FPS before fine detail.
 * A browser/driver may ignore this hint: it is not a quality guarantee. */
export function hintVideoCapture(track: MediaStreamTrack, preset: CapturePreset): void {
  try {
    track.contentHint = preset.fps >= 60 ? 'motion' : 'detail';
  } catch { /* contentHint may be unsupported by a native WebView */ }
}

export function capturePreset(mode: QualityMode, participantCount: number): CapturePreset {
  if (mode !== 'auto') return CAPTURE_PRESETS[mode];
  if (participantCount >= 7) return CAPTURE_PRESETS.economy;
  if (participantCount >= 4) return CAPTURE_PRESETS.balanced;
  if (participantCount >= 3) return CAPTURE_PRESETS.fluid;
  return CAPTURE_PRESETS.ultra;
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
  /** Estatística do RTP enviado ou recebido, nunca o FPS simplesmente solicitado. */
  videoDirection: 'outbound-rtp' | 'inbound-rtp' | null;
};

export const emptyMetrics: NetworkMetrics = {
  state: 'unavailable', rttMs: null, estimatedUplinkMbps: null,
  direct: null, videoWidth: null, videoHeight: null, videoFps: null, videoDirection: null,
};

/** Returns measured encoded/decoded RTP frames, not the chosen capture preset. */
export function actualVideoRtp(
  stats: RTCStatsReport,
  direction: 'outbound-rtp' | 'inbound-rtp',
): Pick<NetworkMetrics, 'videoWidth' | 'videoHeight' | 'videoFps' | 'videoDirection'> {
  const candidates: { width: number | null; height: number | null; fps: number | null }[] = [];
  stats.forEach(entry => {
    if (entry.type !== direction) return;
    const record = entry as unknown as Record<string, unknown>;
    if (record.kind !== 'video' && record.mediaType !== 'video') return;
    // Do not mistake a disabled video sender for an active transmission.
    if (record.active === false) return;
    const width = typeof record.frameWidth === 'number' && record.frameWidth > 0 ? record.frameWidth : null;
    const height = typeof record.frameHeight === 'number' && record.frameHeight > 0 ? record.frameHeight : null;
    const fps = typeof record.framesPerSecond === 'number' && record.framesPerSecond >= 0
      ? Math.round(record.framesPerSecond * 10) / 10 : null;
    candidates.push({ width, height, fps });
  });
  const found = candidates.find(candidate => candidate.fps !== null) ?? candidates[0];
  return {
    videoWidth: found?.width ?? null,
    videoHeight: found?.height ?? null,
    videoFps: found?.fps ?? null,
    videoDirection: found ? direction : null,
  };
}

/** Use the selected candidate pair, not an arbitrary pair from getStats(). */
export function summarizeRTCStats(
  stats: RTCStatsReport,
  connectionState: RTCPeerConnectionState,
  videoStats?: RTCStatsReport | null,
  videoDirection: 'outbound-rtp' | 'inbound-rtp' = 'outbound-rtp',
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
  const video = videoStats ? actualVideoRtp(videoStats, videoDirection) : {
    videoWidth: null, videoHeight: null, videoFps: null, videoDirection: null,
  };
  return {
    state: connectionState === 'connected'
      ? (rtt !== null && rtt > 500 ? 'unstable' : 'connected')
      : connectionState === 'connecting' || connectionState === 'new'
        ? 'connecting' : 'unavailable',
    rttMs: rtt,
    estimatedUplinkMbps: available,
    direct: candidateType ? candidateType !== 'relay' : null,
    ...video,
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
