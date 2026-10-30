import { beforeEach, describe, expect, it, vi } from 'vitest';

// Verify the real RoomSession routing code against an in-memory PeerJS transport.
// This is NOT a substitute for cross-network WebRTC/device testing.
const fake = vi.hoisted(() => ({
  peers: new Map<string, unknown>(),
  sequence: 0,
}));

vi.mock('peerjs', () => {
  type Handler = (...args: unknown[]) => void;
  class Emitter {
    listeners = new Map<string, Handler[]>();
    on(event: string, fn: Handler) {
      this.listeners.set(event, [...(this.listeners.get(event) || []), fn]);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      for (const fn of this.listeners.get(event) || []) fn(...args);
    }
  }
  class Connection extends Emitter {
    open = false;
    other: Connection | null = null;
    closed = false;
    constructor(readonly peer: string) { super(); }
    send(data: unknown) {
      if (!this.open || this.closed) return;
      queueMicrotask(() => this.other?.emit('data', data));
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.open = false;
      this.emit('close');
      if (this.other && !this.other.closed) this.other.close();
    }
  }
  class MockPeer extends Emitter {
    readonly id: string;
    private connections = new Set<Connection>();
    constructor(idOrOptions?: string | object) {
      super();
      this.id = typeof idOrOptions === 'string' ? idOrOptions : 'guest-' + (++fake.sequence);
      fake.peers.set(this.id, this);
      queueMicrotask(() => this.emit('open', this.id));
    }
    connect(destination: string) {
      const local = new Connection(destination);
      const remote = new Connection(this.id);
      local.other = remote;
      remote.other = local;
      this.connections.add(local);
      queueMicrotask(() => {
        const target = fake.peers.get(destination) as MockPeer | undefined;
        if (!target) { this.emit('error', { type: 'peer-unavailable' }); return; }
        target.connections.add(remote);
        target.emit('connection', remote);
        queueMicrotask(() => {
          local.open = true;
          remote.open = true;
          local.emit('open');
          remote.emit('open');
        });
      });
      return local;
    }
    destroy() {
      fake.peers.delete(this.id);
      for (const c of this.connections) c.close();
      this.connections.clear();
    }
    reconnect() { /* not necessary for the in-memory transport */ }
  }
  return { Peer: MockPeer };
});

import { RoomSession, emptyRoom, type RoomSnapshot } from './session';
const CODE = 'ABCDEFGHJKLMNPQR';
const wait = async (predicate: () => boolean, timeout = 700) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('Test timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
function make(name: string) {
  let latest: RoomSnapshot = { ...emptyRoom };
  const session = new RoomSession(name, state => { latest = state; });
  return { session, snapshot: () => latest };
}
beforeEach(() => { fake.peers.clear(); fake.sequence = 0; });

describe('fluxos P2P de texto (transportador PeerJS simulado)', () => {
  it('conecta anfitrião e convidado pelo mesmo código e troca mensagens nos dois sentidos', async () => {
    const ana = make('Ana'), bia = make('Bia');
    ana.session.startHosting(CODE);
    await wait(() => ana.snapshot().phase === 'connected');
    bia.session.startJoining(CODE);
    await wait(() => bia.snapshot().phase === 'connected');
    expect(ana.snapshot().members.map(m => m.name)).toEqual(['Ana', 'Bia']);
    expect(bia.snapshot().members.length).toBe(2);
    expect(bia.session.send('Olá Ana')).toBe(true);
    await wait(() => ana.snapshot().messages.length === 1 && bia.snapshot().messages.length === 1);
    expect(ana.snapshot().messages[0].author).toBe('Bia');
    expect(ana.snapshot().messages[0].text).toBe('Olá Ana');
    expect(ana.session.send('Oi, Bia!')).toBe(true);
    await wait(() => bia.snapshot().messages.length === 2);
    expect(bia.snapshot().messages.map(m => m.text)).toEqual(['Olá Ana', 'Oi, Bia!']);
    ana.session.stop();
    bia.session.stop();
  });

  it('repassa mensagens de um convidado para outro, sem backend local', async () => {
    const host = make('Host'), one = make('Um'), two = make('Dois');
    host.session.startHosting(CODE);
    await wait(() => host.snapshot().phase === 'connected');
    one.session.startJoining(CODE);
    await wait(() => one.snapshot().phase === 'connected');
    two.session.startJoining(CODE);
    await wait(() => two.snapshot().phase === 'connected' && one.snapshot().members.length === 3);
    two.session.send('Mensagem para todos');
    await wait(() => one.snapshot().messages.length === 1);
    expect(one.snapshot().messages[0].author).toBe('Dois');
    host.session.stop();
    await wait(() => one.snapshot().phase === 'reconnecting' && two.snapshot().phase === 'reconnecting');
    await wait(() => one.snapshot().phase === 'error' && two.snapshot().phase === 'error', 6500);
    one.session.stop();
    two.session.stop();
  });

  it('recusa o décimo convidado quando já há 10 pessoas na sala', async () => {
    const host = make('Host');
    const guests = Array.from({ length: 10 }, (_, i) => make('Convidado ' + i));
    host.session.startHosting(CODE);
    await wait(() => host.snapshot().phase === 'connected');
    for (const guest of guests.slice(0, 9)) {
      guest.session.startJoining(CODE);
      await wait(() => guest.snapshot().phase === 'connected');
    }
    expect(host.snapshot().members).toHaveLength(10);
    guests[9].session.startJoining(CODE);
    await wait(() => guests[9].snapshot().phase === 'error');
    expect(guests[9].snapshot().error).toContain('cheia');
    host.session.stop();
    guests.forEach(g => g.session.stop());
  });

  it('reconecta quando o anfitrião reaparece usando o mesmo código', async () => {
    const oldHost = make('Host antigo'), guest = make('Amigo');
    oldHost.session.startHosting(CODE);
    await wait(() => oldHost.snapshot().phase === 'connected');
    guest.session.startJoining(CODE);
    await wait(() => guest.snapshot().phase === 'connected');
    oldHost.session.stop();
    await wait(() => guest.snapshot().phase === 'reconnecting');
    const newHost = make('Novo host');
    newHost.session.startHosting(CODE);
    await wait(() => newHost.snapshot().phase === 'connected');
    await wait(() => guest.snapshot().phase === 'connected', 6000);
    expect(guest.snapshot().members[0].name).toBe('Novo host');
    newHost.session.stop();
    guest.session.stop();
  });

  it('informa erro quando anfitrião não existe', async () => {
    const guest = make('Sem anfitrião');
    guest.session.startJoining(CODE);
    await wait(() => guest.snapshot().phase === 'error', 6500);
    expect(guest.snapshot().error).toContain('Não foi possível restabelecer');
    guest.session.stop();
  });
});
