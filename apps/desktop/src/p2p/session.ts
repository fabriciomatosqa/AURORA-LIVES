import { Peer, type DataConnection, type MediaConnection } from 'peerjs';
import {
  ROOM_CAPACITY, cleanName, cleanText, decodeWire, generateRoomCode,
  hostPeerId, mergeMessages, normalizeRoomCode,
  type ChatMessage, type Member, type Wire,
} from './protocol';

export type Phase = 'idle' | 'connecting' | 'connected' | 'error';
export type Role = 'host' | 'guest' | null;
export type MediaKind = 'microphone' | 'screen';
export type RemoteMedia = { id: string; peerId: string; kind: MediaKind; stream: MediaStream };
export type RoomSnapshot = {
  phase: Phase;
  role: Role;
  code: string;
  localId: string;
  members: Member[];
  messages: ChatMessage[];
  remoteMedia: RemoteMedia[];
  microphone: boolean;
  screen: boolean;
  localScreen: MediaStream | null;
  warning: string;
  error: string;
};
export const emptyRoom: RoomSnapshot = {
  phase: 'idle', role: null, code: '', localId: '', members: [],
  messages: [], remoteMedia: [], microphone: false, screen: false,
  localScreen: null, warning: '', error: '',
};

/**
 * Ephemeral, no-account, no-paid-server P2P room.
 *
 * The free shared PeerJS Cloud is SIGNALING ONLY. The host acts as the relay
 * for small text messages between independent WebRTC DataChannels. Media
 * is sent directly from every sharer to each known participant (mesh).
 * No media is uploaded to the signaling service; TURN is intentionally absent.
 */
export class RoomSession {
  private peer: Peer | null = null;
  private hostLink: DataConnection | null = null;
  private readonly connections = new Map<string, DataConnection>();
  private readonly pending = new Set<DataConnection>();
  private readonly mediaCalls = new Map<string, MediaConnection>();
  private localMic: MediaStream | null = null;
  private localDisplay: MediaStream | null = null;
  private joiningTimeout: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private releasing = false;
  private waitingMic = false;
  private waitingDisplay = false;
  private name: string;
  private value: RoomSnapshot = { ...emptyRoom };
  readonly notify: (next: RoomSnapshot) => void;

  constructor(name: string, notify: (next: RoomSnapshot) => void) {
    this.name = cleanName(name);
    this.notify = notify;
  }

  private emit(patch: Partial<RoomSnapshot> = {}): void {
    if (this.stopped) return;
    this.value = { ...this.value, ...patch };
    this.notify({ ...this.value });
  }

  private fail(reason: string): void {
    if (this.stopped) return;
    this.release();
    this.emit({
      phase: 'error', members: [], remoteMedia: [],
      localScreen: null, screen: false, microphone: false, error: reason,
    });
  }

  private clearTimeout(): void {
    if (this.joiningTimeout) clearTimeout(this.joiningTimeout);
    this.joiningTimeout = null;
  }

  private release(): void {
    if (this.releasing) return;
    this.releasing = true;
    this.clearTimeout();
    this.localMic?.getTracks().forEach(track => track.stop());
    this.localDisplay?.getTracks().forEach(track => track.stop());
    this.localMic = null;
    this.localDisplay = null;
    for (const call of this.mediaCalls.values()) call.close();
    this.mediaCalls.clear();
    for (const link of this.connections.values()) link.close();
    this.connections.clear();
    this.pending.clear();
    const guestLink = this.hostLink;
    this.hostLink = null;
    guestLink?.close();
    const oldPeer = this.peer;
    this.peer = null;
    oldPeer?.destroy();
    this.releasing = false;
  }

  stop(): void {
    if (this.stopped) return;
    this.release();
    this.stopped = true;
    this.notify({ ...emptyRoom });
  }

  static newCode(): string { return generateRoomCode(); }

  startHosting(code: string): void {
    this.start('host', code);
  }

  startJoining(code: string): void {
    this.start('guest', code);
  }

  private start(role: 'host' | 'guest', code: string): void {
    const normalized = normalizeRoomCode(code);
    if (!normalized) { this.fail('Código inválido. Digite os 16 caracteres do convite.'); return; }
    this.emit({ phase: 'connecting', role, code: normalized, error: '', warning: '' });
    // No TURN credentials or paid infrastructure. ICE can fail on restrictive NATs.
    const options = {
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    };
    const peer = role === 'host' ? new Peer(hostPeerId(normalized), options) : new Peer(options);
    this.peer = peer;
    peer.on('open', id => {
      if (this.stopped || this.peer !== peer) return;
      this.emit({ localId: id });
      if (role === 'host') {
        if (this.value.phase === 'connected') return; // signaling reconnected; preserve members
        this.emit({
          phase: 'connected',
          members: [{ id, name: this.name, host: true }],
          warning: 'A sala existe apenas enquanto o anfitrião permanece conectado.',
        });
      } else if (!this.hostLink?.open) {
        this.joinHost(id);
      }
    });
    peer.on('connection', link => {
      if (role !== 'host') { link.close(); return; }
      this.onGuestLink(link);
    });
    peer.on('call', call => this.onIncomingCall(call));
    peer.on('error', err => {
      if (this.stopped || this.peer !== peer) return;
      const reason = err.type === 'unavailable-id'
        ? 'O código já está sendo usado. Crie outra sala.'
        : err.type === 'peer-unavailable'
          ? 'Sala não encontrada. Confirme o código e se o anfitrião está conectado.'
          : 'Erro na conexão P2P (' + err.type + '). Tente novamente ou use outra rede.';
      this.fail(reason);
    });
    peer.on('disconnected', () => {
      if (this.stopped || this.releasing || this.peer !== peer) return;
      this.emit({ warning: 'Sinalização temporariamente offline. Conexões existentes podem continuar; novos convites podem falhar.' });
      try { peer.reconnect(); } catch { /* connection may already be reconnecting */ }
    });
  }

  private joinHost(localId: string): void {
    const peer = this.peer;
    if (!peer) return;
    const link = peer.connect(hostPeerId(this.value.code), { reliable: true, serialization: 'json' });
    this.hostLink = link;
    this.joiningTimeout = setTimeout(() => {
      if (this.value.phase === 'connecting') {
        this.fail('Tempo de conexão esgotado. O anfitrião pode estar offline ou a rede bloqueia o P2P.');
      }
    }, 20000);
    link.on('open', () => {
      if (this.stopped || this.hostLink !== link) return;
      link.send({ type: 'join', version: 1, name: this.name } satisfies Wire);
    });
    link.on('data', raw => {
      if (this.stopped || this.hostLink !== link) return;
      const wire = decodeWire(raw);
      if (!wire) return;
      if (wire.type === 'reject') {
        this.fail(wire.reason === 'full' ? 'Sala cheia (máximo de 10 pessoas).' : 'Convite recusado.');
        return;
      }
      if (wire.type === 'welcome') {
        const valid = wire.members.some(m => m.id === localId)
          && wire.members.some(m => m.id === link.peer && m.host);
        if (!valid) { this.fail('Resposta inválida do anfitrião.'); return; }
        this.clearTimeout();
        this.emit({
          phase: 'connected', members: wire.members,
          messages: mergeMessages([], wire.messages),
          error: '', warning: 'Conexão direta estabelecida. Sem histórico permanente.',
        });
        link.send({ type: 'ready' } satisfies Wire);
        this.syncMediaTargets();
      } else if (wire.type === 'members' && this.value.phase === 'connected') {
        if (wire.members.some(m => m.id === localId)) this.updateMembers(wire.members);
      } else if (wire.type === 'chat' && this.value.phase === 'connected') {
        this.emit({ messages: mergeMessages(this.value.messages, [wire.message]) });
      }
    });
    link.on('close', () => {
      if (!this.stopped && !this.releasing && this.hostLink === link) {
        this.fail('O anfitrião saiu ou a conexão direta foi encerrada.');
      }
    });
    link.on('error', () => {
      if (!this.stopped && !this.releasing && this.hostLink === link) this.fail('Falha no canal de dados P2P.');
    });
  }

  private onGuestLink(link: DataConnection): void {
    if (this.releasing || this.value.phase !== 'connected') { link.close(); return; }
    if (this.pending.size >= ROOM_CAPACITY * 2) { link.close(); return; }
    this.pending.add(link);
    link.on('open', () => {
      if (this.stopped) { link.close(); return; }
      if (this.connections.size >= ROOM_CAPACITY - 1) {
        link.send({ type: 'reject', reason: 'full' } satisfies Wire);
        setTimeout(() => link.close(), 150);
      }
    });
    link.on('data', raw => {
      if (this.stopped) return;
      const wire = decodeWire(raw);
      if (!wire) { link.close(); return; }
      if (!this.connections.has(link.peer)) {
        if (wire.type !== 'join') { link.close(); return; }
        if (this.connections.size >= ROOM_CAPACITY - 1) {
          link.send({ type: 'reject', reason: 'full' } satisfies Wire);
          setTimeout(() => link.close(), 150);
          return;
        }
        this.pending.delete(link);
        this.connections.set(link.peer, link);
        const incomingMember: Member = { id: link.peer, name: cleanName(wire.name), host: false };
        const members = [...this.value.members.filter(m => m.id !== link.peer), incomingMember];
        this.emit({ members });
        link.send({ type: 'welcome', version: 1, members, messages: this.value.messages } satisfies Wire);
        this.broadcastMembers();
        // Wait for guest's ready acknowledgement before attempting media calls.
        return;
      }
      if (wire.type === 'send') this.addHostMessage(link.peer, wire.text);
      if (wire.type === 'ready') this.syncMediaTargets();
    });
    link.on('close', () => this.dropGuest(link));
    link.on('error', () => this.dropGuest(link));
  }

  private dropGuest(link: DataConnection): void {
    this.pending.delete(link);
    if (this.releasing || this.stopped) return;
    if (this.connections.get(link.peer) !== link) return;
    this.connections.delete(link.peer);
    this.removeMediaFor(link.peer);
    this.emit({ members: this.value.members.filter(m => m.id !== link.peer) });
    this.broadcastMembers();
  }

  private broadcastMembers(): void {
    const announcement: Wire = { type: 'members', members: this.value.members };
    for (const link of this.connections.values()) if (link.open) link.send(announcement);
  }

  private updateMembers(next: Member[]): void {
    const previousIDs = new Set(this.value.members.map(m => m.id));
    const nextIDs = new Set(next.map(m => m.id));
    for (const id of previousIDs) if (!nextIDs.has(id)) this.removeMediaFor(id);
    this.emit({ members: next });
    this.syncMediaTargets();
  }

  private addHostMessage(senderId: string, text: string): void {
    const validText = cleanText(text);
    const sender = this.value.members.find(member => member.id === senderId);
    if (!validText || !sender) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(), senderId, author: sender.name,
      text: validText, sentAt: Date.now(),
    };
    this.emit({ messages: mergeMessages(this.value.messages, [message]) });
    const outgoing: Wire = { type: 'chat', message };
    for (const link of this.connections.values()) if (link.open) link.send(outgoing);
  }

  send(text: string): boolean {
    const valid = cleanText(text);
    if (!valid || this.value.phase !== 'connected') return false;
    if (this.value.role === 'host') {
      this.addHostMessage(this.value.localId, valid);
      return true;
    }
    if (!this.hostLink?.open) return false;
    this.hostLink.send({ type: 'send', text: valid } satisfies Wire);
    return true;
  }

  private mediaKey(kind: MediaKind, peerId: string, direction: 'in' | 'out'): string {
    return direction + ':' + kind + ':' + peerId;
  }

  private trackCall(call: MediaConnection, kind: MediaKind, direction: 'in' | 'out'): void {
    const key = this.mediaKey(kind, call.peer, direction);
    const replaced = this.mediaCalls.get(key);
    this.mediaCalls.set(key, call);
    if (replaced) replaced.close();
    const clear = () => {
      if (this.releasing || this.stopped || this.mediaCalls.get(key) !== call) return;
      this.mediaCalls.delete(key);
      if (direction === 'in') {
        this.emit({ remoteMedia: this.value.remoteMedia.filter(item => item.id !== key) });
      }
    };
    call.on('close', clear);
    call.on('error', clear);
    if (direction === 'in') {
      call.on('stream', remote => {
        if (this.stopped || this.mediaCalls.get(key) !== call) return;
        const other = this.value.remoteMedia.filter(item => item.id !== key);
        this.emit({ remoteMedia: [...other, { id: key, peerId: call.peer, kind, stream: remote }] });
        remote.getTracks().forEach(track => track.addEventListener('ended', clear, { once: true }));
      });
    }
  }

  private onIncomingCall(call: MediaConnection): void {
    const meta = call.metadata as { room?: unknown; kind?: unknown } | null;
    const kind = meta?.kind;
    const authorized = this.value.phase === 'connected'
      && meta?.room === this.value.code
      && this.value.members.some(member => member.id === call.peer);
    if (this.releasing || !authorized || (kind !== 'screen' && kind !== 'microphone')) {
      call.close();
      return;
    }
    this.trackCall(call, kind, 'in');
    // A one-way WebRTC call: receiver does not need to enable its own microphone.
    call.answer();
  }

  private callMember(id: string, kind: MediaKind, stream: MediaStream): void {
    const peer = this.peer;
    if (!peer || id === this.value.localId || this.value.phase !== 'connected') return;
    const key = this.mediaKey(kind, id, 'out');
    if (this.mediaCalls.has(key)) return;
    const call = peer.call(id, stream, { metadata: { room: this.value.code, kind } });
    if (call) this.trackCall(call, kind, 'out');
  }

  private syncMediaTargets(): void {
    for (const member of this.value.members) {
      if (member.id === this.value.localId) continue;
      if (this.localMic) this.callMember(member.id, 'microphone', this.localMic);
      if (this.localDisplay) this.callMember(member.id, 'screen', this.localDisplay);
    }
  }

  private removeMediaFor(id: string): void {
    for (const kind of ['microphone', 'screen'] as const) {
      for (const direction of ['in', 'out'] as const) {
        const key = this.mediaKey(kind, id, direction);
        const call = this.mediaCalls.get(key);
        this.mediaCalls.delete(key);
        call?.close();
      }
    }
    this.emit({ remoteMedia: this.value.remoteMedia.filter(item => item.peerId !== id) });
  }

  async enableMicrophone(): Promise<void> {
    if (this.waitingMic || this.localMic || this.value.phase !== 'connected') return;
    this.waitingMic = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microfone indisponível nesta plataforma.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (this.stopped || this.value.phase !== 'connected') {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.localMic = stream;
      stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => this.disableMicrophone(), { once: true }));
      this.emit({ microphone: true, error: '' });
      this.syncMediaTargets();
    } finally { this.waitingMic = false; }
  }

  disableMicrophone(): void {
    if (!this.localMic) return;
    this.localMic.getTracks().forEach(track => track.stop());
    this.localMic = null;
    for (const member of this.value.members) {
      const key = this.mediaKey('microphone', member.id, 'out');
      this.mediaCalls.get(key)?.close();
      this.mediaCalls.delete(key);
    }
    this.emit({ microphone: false });
  }

  async shareScreen(): Promise<void> {
    if (this.waitingDisplay || this.localDisplay || this.value.phase !== 'connected') return;
    this.waitingDisplay = true;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Compartilhar tela não é suportado pelo mecanismo de vídeo deste sistema.');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
        audio: true,
      });
      if (this.stopped || this.value.phase !== 'connected') {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.localDisplay = stream;
      stream.getVideoTracks().forEach(track =>
        track.addEventListener('ended', () => this.stopScreen(), { once: true }));
      this.emit({
        screen: true, localScreen: stream, error: '',
        warning: stream.getAudioTracks().length
          ? 'Tela e áudio do sistema: disponibilidade sujeita ao WebView e SO.'
          : 'Tela iniciada sem áudio do sistema; o suporte varia entre Windows e Linux.',
      });
      this.syncMediaTargets();
    } finally { this.waitingDisplay = false; }
  }

  stopScreen(): void {
    if (!this.localDisplay) return;
    this.localDisplay.getTracks().forEach(track => track.stop());
    this.localDisplay = null;
    for (const member of this.value.members) {
      const key = this.mediaKey('screen', member.id, 'out');
      this.mediaCalls.get(key)?.close();
      this.mediaCalls.delete(key);
    }
    this.emit({ screen: false, localScreen: null });
  }
}
