import type { RoomSnapshot } from '../p2p/session';

// Unchanged source: AURORA AutoFill/assets/command_click.wav ("Water Droplet 2").
const DROP_URL = '/sounds/command_click.wav';

type Presence = Pick<RoomSnapshot, 'phase' | 'code' | 'localId' | 'members'>;

/** Do not ring for your own admission, the initial member list, or reconnects. */
export function hasNewRemoteMember(before: Presence, after: Presence): boolean {
  if (before.phase !== 'connected' || after.phase !== 'connected' ||
      !before.code || before.code !== after.code ||
      !before.localId || before.localId !== after.localId) return false;

  const known = new Set(before.members.map(member => member.id));
  return after.members.some(member => member.id !== after.localId && !known.has(member.id));
}

let context: AudioContext | null = null;
let bufferPromise: Promise<AudioBuffer> | null = null;

/** Called synchronously from the Create/Join click to unlock Android audio. */
export function prepareRoomJoinSound(): void {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
  try {
    context ??= new window.AudioContext();
    const audio = context;
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
    if (!bufferPromise) {
      bufferPromise = fetch(DROP_URL)
        .then(response => {
          if (!response.ok) throw new Error('Som de entrada não disponível.');
          return response.arrayBuffer();
        })
        .then(bytes => audio.decodeAudioData(bytes))
        .catch(error => {
          bufferPromise = null; // retry on the next explicit user action
          throw error;
        });
      void bufferPromise.catch(() => {}); // optional UI feedback must never disrupt the room
    }
  } catch {
    // Rooms still work when sound playback is disabled or unsupported.
  }
}

/** Play one unmodified water-drop sample for each incoming membership update. */
export function playRoomJoinSound(): void {
  const audio = context;
  const pending = bufferPromise;
  if (!audio || !pending) return;
  void pending.then(buffer => {
    function play() {
      if (audio!.state === 'closed') return;
      const source = audio!.createBufferSource();
      source.buffer = buffer;
      source.connect(audio!.destination);
      source.start();
    }
    if (audio.state === 'suspended') {
      void audio.resume().then(play).catch(() => {});
    } else {
      play();
    }
  }).catch(() => {}); // Autoplay policy and WebView errors are nonfatal.
}
