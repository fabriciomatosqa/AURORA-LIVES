import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowRight, Bookmark, Check, ChevronDown, CircleHelp, Copy,
  Gauge, Hash, Headphones, Home, Info, Link2, LockKeyhole, Menu,
  MessageCircle, Mic, MicOff, MonitorUp, Moon, PictureInPicture2, Plus,
  RadioTower, Send, Settings2, ShieldCheck, Sparkles, Sun, Trash2,
  Users, VideoOff, Volume2, VolumeX, Wifi, X,
} from 'lucide-react';
import { RoomSession, emptyRoom, type RemoteMedia, type RoomSnapshot } from './p2p/session';
import { cleanName, formatRoomCode, normalizeRoomCode } from './p2p/protocol';
import { capabilities, capturePreset, type QualityMode } from './p2p/quality';
import { inviteMessage, readSavedInvites, saveInvite, SAVED_INVITES_KEY, type SavedInvite } from './p2p/invites';
import { useOnlineUpdater } from './updates/useOnlineUpdater';
import { UpdateIndicator, UpdateSettings } from './updates/UpdateSettings';
import { UpdatePrompt } from './updates/UpdatePrompt';
import { isAndroidRuntime } from './platform';

type Theme = 'dark' | 'light' | 'system';

function fromStorage(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function Crystal({ size = 42, className = '' }: { size?: number; className?: string }) {
  return <img
    className={'crystal ' + className}
    src="/aurora-mark.webp"
    width={size}
    height={size}
    alt="Emblema cristalino original da AURORA"
    draggable={false}
  />;
}

function Avatar({ name, own = false, size = 'normal' }: { name: string; own?: boolean; size?: 'normal' | 'small' }) {
  return <span className={'person-avatar ' + (own ? 'is-own ' : '') + (size === 'small' ? 'avatar-small' : '')} aria-hidden="true">
    {name.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || '?'}
  </span>;
}

function MediaPlayer({ stream, muted, label }: { stream: MediaStream; muted: boolean; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    node.srcObject = stream;
    void node.play().catch(() => { /* A reprodução pode depender de interação */ });
    return () => { node.srcObject = null; };
  }, [stream]);

  async function floatVideo() {
    const node = video.current;
    if (!node?.requestPictureInPicture || !document.pictureInPictureEnabled) return;
    try {
      setError('');
      await node.requestPictureInPicture();
    } catch {
      setError('Janela flutuante indisponível neste dispositivo.');
    }
  }

  return <div className="stream-tile">
    <video ref={video} autoPlay playsInline muted={muted} controls aria-label={label} />
    <span className="stream-title"><span className="stream-title-icon"><MonitorUp size={14}/></span>{label}</span>
    {typeof document !== 'undefined' && document.pictureInPictureEnabled && <button
      type="button" className="float-video icon-control" onClick={() => void floatVideo()}
      aria-label={'Exibir ' + label + ' em janela flutuante'} title="Janela flutuante">
      <PictureInPicture2 size={17}/>
    </button>}
    {error && <span className="stream-error" role="status">{error}</span>}
  </div>;
}

function AudioListener({ media, name, muted }: { media: RemoteMedia; name: string; muted: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const node = audio.current;
    if (!node) return;
    node.srcObject = media.stream;
    void node.play().catch(() => { /* Os controles permanecem disponíveis */ });
    return () => { node.srcObject = null; };
  }, [media.stream]);

  return <div className="audio-listener">
    <Avatar name={name} size="small"/>
    <div className="audio-description"><strong>{name}</strong><span>Microfone conectado</span></div>
    <audio ref={audio} autoPlay controls muted={muted} aria-label={'Áudio de ' + name}/>
  </div>;
}

function MiniMetric({ icon, label, value, accent = false }: {
  icon: ReactNode; label: string; value: string; accent?: boolean;
}) {
  return <div className="mini-metric">
    <span className="mini-metric-symbol">{icon}</span>
    <span>{label}</span>
    <strong className={accent ? 'metric-accent' : ''}>{value}</strong>
  </div>;
}

export default function App() {
  const [room, setRoom] = useState<RoomSnapshot>(emptyRoom);
  const [nickname, setNickname] = useState(() => fromStorage('aurora.nickname', 'Visitante'));
  const [invite, setInvite] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth > 1320);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [membersExpanded, setMembersExpanded] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [busyMedia, setBusyMedia] = useState(false);
  const isAndroid = useMemo(isAndroidRuntime, []);
  const [mobileTab, setMobileTab] = useState<'stage' | 'chat' | 'members'>('stage');
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = fromStorage('aurora.theme', 'dark');
    return stored === 'light' || stored === 'system' ? stored : 'dark';
  });
  const [savedInvites, setSavedInvites] = useState<SavedInvite[]>(() =>
    readSavedInvites(fromStorage(SAVED_INVITES_KEY, '')));
  const [qualityPreference, setQualityPreference] = useState<QualityMode>(() => {
    const value = fromStorage('aurora.quality', 'auto');
    return ['auto', 'economy', 'balanced', 'high', 'ultra'].includes(value) ? value as QualityMode : 'auto';
  });

  const backState = useRef({ settingsOpen, sidebarOpen, inspectorOpen, mobileTab, connected: false, joining: false });
  const session = useRef<RoomSession | null>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const support = useMemo(capabilities, []);
  const updater = useOnlineUpdater();
  const connected = room.phase === 'connected';
  const joining = room.phase === 'connecting' || room.phase === 'reconnecting';
  backState.current = { settingsOpen, sidebarOpen, inspectorOpen, mobileTab, connected, joining };
  const isHost = room.role === 'host';
  const liveStreams = room.remoteMedia.filter(item => item.kind === 'screen');
  const microphoneStreams = room.remoteMedia.filter(item => item.kind === 'microphone');
  const broadcasting = room.screen || liveStreams.length > 0;
  const memberCount = room.members.length;
  const selectedProfile = capturePreset(room.qualityMode, memberCount);

  useEffect(() => {
    if (isAndroid) {
      document.documentElement.dataset.platform = 'android';
    }
    return () => {
      if (isAndroid) delete document.documentElement.dataset.platform;
    };
  }, [isAndroid]);

  useEffect(() => {
    if (!isAndroid) return;
    // Add a single synthetic history entry; the Android back key can now
    // dismiss an overlay without exiting the app. Do not add a history entry
    // on every tab change, which would trap users in an ever-growing stack.
    window.history.pushState({ auroraMobile: true }, '');
    function onMobileBack() {
      const current = backState.current;
      if (current.settingsOpen) setSettingsOpen(false);
      else if (current.sidebarOpen) setSidebarOpen(false);
      else if (current.inspectorOpen) setInspectorOpen(false);
      else if (current.connected && current.mobileTab !== 'stage') setMobileTab('stage');
      else if (current.connected) {
        if (window.confirm('Sair da sala e desconectar os participantes?')) leaveRoom();
      } else if (current.joining) leaveRoom();
      window.history.pushState({ auroraMobile: true }, '');
    }
    window.addEventListener('popstate', onMobileBack);
    return () => window.removeEventListener('popstate', onMobileBack);
  }, [isAndroid]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function applyTheme() {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    }
    applyTheme();
    media.addEventListener?.('change', applyTheme);
    try { localStorage.setItem('aurora.theme', theme); } catch { /* armazenamento não disponível */ }
    return () => media.removeEventListener?.('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    function adjustPanels() {
      // Narrow windows use drawers: don't leave desktop inspector as a
      // blocking overlay after resizing the application.
      if (window.innerWidth <= 1320) setInspectorOpen(false);
      if (window.innerWidth > 740) setSidebarOpen(false);
    }
    window.addEventListener('resize', adjustPanels);
    return () => window.removeEventListener('resize', adjustPanels);
  }, []);

  useEffect(() => () => session.current?.stop(), []);

  useEffect(() => {
    if (connected && messageList.current) {
      messageList.current.scrollTop = messageList.current.scrollHeight;
    }
  }, [connected, room.messages]);

  useEffect(() => {
    if (!settingsOpen) return;
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSettingsOpen(false);
    }
    window.addEventListener('keydown', closeWithEscape);
    return () => window.removeEventListener('keydown', closeWithEscape);
  }, [settingsOpen]);

  function openRoom(mode: 'host' | 'guest', storedCode?: string) {
    setSidebarOpen(false);
    setInspectorOpen(false);
    if (!support.webRTC) {
      setFeedback('Este ambiente não oferece WebRTC. Veja o diagnóstico de compatibilidade.');
      return;
    }
    const code = mode === 'host' ? RoomSession.newCode() : normalizeRoomCode(storedCode || invite);
    if (!code) {
      setFeedback('Informe um código de convite válido com 16 caracteres.');
      return;
    }
    session.current?.stop();
    setFeedback('');
    setCopied(false);
    setMobileTab('stage');
    const current = new RoomSession(cleanName(nickname), next => setRoom(next));
    session.current = current;
    void current.setQuality(qualityPreference);
    if (mode === 'host') current.startHosting(code);
    else current.startJoining(code);
  }

  function leaveRoom() {
    session.current?.stop();
    session.current = null;
    setRoom({ ...emptyRoom });
    setMessage('');
    setFeedback('');
    setCopied(false);
    setInspectorOpen(false);
    setMobileTab('stage');
  }

  async function copyInvite(complete = false) {
    if (complete && isAndroid && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Convite AURORA LIVES', text: inviteMessage(room.code) });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Fall back to clipboard if the Android share sheet is unavailable.
      }
    }
    try {
      await navigator.clipboard.writeText(complete ? inviteMessage(room.code) : formatRoomCode(room.code));
      setCopied(true);
      setFeedback(complete ? 'Convite pronto para enviar no WhatsApp.' : 'Código copiado com sucesso.');
    } catch {
      setFeedback('Não foi possível copiar automaticamente. Selecione o código e copie.');
    }
  }

  function saveCurrentInvite() {
    if (!room.code) return;
    const saved = saveInvite(savedInvites, room.code, 'Encontro AURORA');
    setSavedInvites(saved);
    try { localStorage.setItem(SAVED_INVITES_KEY, JSON.stringify(saved)); } catch { /* indisponível */ }
    setFeedback('Convite salvo somente neste dispositivo.');
  }

  function removeSavedInvite(code: string) {
    const remaining = savedInvites.filter(item => item.code !== code);
    setSavedInvites(remaining);
    try { localStorage.setItem(SAVED_INVITES_KEY, JSON.stringify(remaining)); } catch { /* indisponível */ }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.current?.send(message)) {
      setMessage('');
      setFeedback('');
    } else if (message.trim()) {
      setFeedback('Não foi possível enviar a mensagem. Verifique a conexão.');
    }
  }

  async function toggleMicrophone() {
    setBusyMedia(true);
    setFeedback('');
    try {
      if (room.microphone) session.current?.disableMicrophone();
      else await session.current?.enableMicrophone();
    } catch (error) {
      setFeedback('Não foi possível acessar o microfone: ' + (error instanceof Error ? error.message : 'verifique as permissões.'));
    } finally {
      setBusyMedia(false);
    }
  }

  async function toggleDisplay() {
    if (isAndroid) {
      setFeedback('No Android já é possível assistir às transmissões. Para transmitir a própria tela do celular será necessária a captura nativa MediaProjection, que não está disponível nesta prévia.');
      return;
    }
    setBusyMedia(true);
    setFeedback('');
    try {
      if (room.screen) session.current?.stopScreen();
      else await session.current?.shareScreen();
    } catch (error) {
      setFeedback('Não foi possível compartilhar a tela: ' + (error instanceof Error ? error.message : 'verifique as permissões.'));
    } finally {
      setBusyMedia(false);
    }
  }

  async function updateQuality(mode: QualityMode) {
    setQualityPreference(mode);
    try { localStorage.setItem('aurora.quality', mode); } catch { /* indisponível */ }
    try {
      await session.current?.setQuality(mode);
    } catch {
      setFeedback('Não foi possível aplicar este perfil de vídeo.');
    }
  }

  function updateNickname(name: string) {
    setNickname(name);
    try { localStorage.setItem('aurora.nickname', name); } catch { /* indisponível */ }
  }

  const memberName = (peerId: string) => room.members.find(member => member.id === peerId)?.name || 'Participante';

  return <div className={'aurora-app ' + (isAndroid ? 'aurora-mobile' : '')}>
    <div className="environment-glow" aria-hidden="true"/>
    <nav className="workspace-rail" aria-label="Navegação principal">
      <button className="rail-brand" onClick={() => { setSidebarOpen(value => !value); setInspectorOpen(false); }} title="Mostrar ou ocultar canais" aria-label="AURORA LIVES — início">
        <Crystal size={48}/>
      </button>
      <div className="rail-divider" aria-hidden="true"/>
      <div className="rail-control is-active" title="Sala inicial" aria-label="Sala inicial" aria-current="page">
        <Home size={21} strokeWidth={2}/>
      </div>
      <button className="rail-control" disabled title="Comunidades públicas em desenvolvimento" aria-label="Comunidades em desenvolvimento">
        <Users size={20}/>
      </button>
      <span className="rail-spacer"/>
      <button className="rail-control" title="Central de informações" aria-label="Central de informações" onClick={() => { setInspectorOpen(value => !value); setSidebarOpen(false); }} aria-expanded={inspectorOpen}>
        <CircleHelp size={21}/>
      </button>
      <button className="rail-control" title="Abrir configurações" aria-label="Abrir configurações" onClick={() => setSettingsOpen(true)}>
        <Settings2 size={20}/>
      </button>
      <span className="rail-version">A·07</span>
    </nav>

    {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="Fechar painel de canais" onClick={() => setSidebarOpen(false)}/>}
    <aside className={'channel-sidebar ' + (sidebarOpen ? 'sidebar-visible' : '')} aria-label="Espaço e participantes">
      <div className="sidebar-brand">
        <span className="brand-emblem"><Crystal size={34}/></span>
        <span className="brand-name"><strong>AURORA <span>LIVES</span></strong><small>COMUNICAÇÃO SEM LIMITES</small></span>
        <span className="brand-glint" aria-hidden="true"/>
      </div>

      <div className="sidebar-body">
        <div className="sidebar-caption"><span>SEU ESPAÇO</span><span className="caption-bar"/></div>
        <div className="sidebar-current"><span className="sidebar-current-icon"><Home size={17}/></span>
          <span>{connected ? 'Encontro privado' : 'Bem-vindo ao Aurora'}</span><span className="sidebar-active-dot"/></div>

        <div className="sidebar-caption with-space"><span>CANAIS</span><span className="caption-bar"/></div>
        <div className="sidebar-channel"><Hash size={17}/><span>conversa-geral</span><span className="channel-indicator"/></div>
        <div className="sidebar-channel"><RadioTower size={17}/><span>voz-e-transmissão</span></div>

        <div className="sidebar-caption with-space"><span>NA SALA</span><span className="member-counter">{memberCount}/10</span></div>
        <div className="sidebar-members">
          {room.members.length ? room.members.map(member => <div className="sidebar-member" key={member.id}>
            <Avatar name={member.name} size="small" own={member.id === room.localId}/>
            <span>{member.name}{member.id === room.localId ? ' (você)' : ''}</span>
            {member.host && <span className="host-crown" title="Anfitrião">★</span>}
            <span className="online-pin" title="Conectado"/>
          </div>) : <div className="sidebar-empty"><span className="sidebar-empty-icon"><Users size={20}/></span>
            <p>Os participantes aparecerão aqui quando você entrar em uma sala.</p></div>}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className={'sidebar-connection ' + (connected ? 'is-connected' : joining ? 'is-connecting' : '')}>
          <span className="status-indicator"/>
          <span><strong>{connected ? 'Conectado' : joining ? 'Estabelecendo conexão' : 'Pronto para conectar'}</strong>
            <small>{connected ? 'WebRTC ponto a ponto' : 'Sem servidor dedicado'}</small></span>
          <Wifi size={17} aria-hidden="true"/>
        </div>
        <button className="profile-card" onClick={() => setSettingsOpen(true)} title="Editar perfil e preferências">
          <Avatar name={cleanName(nickname)} own/>
          <span><strong>{cleanName(nickname)}</strong><small>Perfil local · Sem cadastro</small></span>
          <Settings2 size={18}/>
        </button>
      </div>
    </aside>

    <main className="workspace-main" id="principal">
      <header className="topbar">
        {isAndroid && <span className="mobile-topbar-logo"><Crystal size={33}/></span>}
        <button className="topbar-menu icon-control" onClick={() => { setSidebarOpen(value => !value); setInspectorOpen(false); }} aria-label="Mostrar canais" aria-expanded={sidebarOpen}><Menu size={21}/></button>
        <span className="topbar-page-icon"><Hash size={21}/></span>
        <div className="topbar-page"><strong>{connected ? 'Encontro privado' : joining ? 'Conectando sua sala' : 'Visão geral'}</strong>
          <small>{connected ? 'Sua comunidade, do seu jeito' : 'Um lugar para se encontrar'}</small></div>
        <div className="topbar-spacer"/>
        <UpdateIndicator updater={updater} onClick={() => setSettingsOpen(true)}/>
        <span className={'topbar-status ' + (connected ? 'topbar-status-live' : '')}>
          <span className="status-indicator"/>
          {connected ? 'Conexão ativa' : joining ? 'Conectando' : 'Prévia 0.0.7'}
        </span>
        <button className="topbar-more icon-control" onClick={() => { setInspectorOpen(value => !value); setSidebarOpen(false); }} aria-expanded={inspectorOpen}
          aria-label="Informações sobre a conexão" title="Informações"><Activity size={19}/></button>
      </header>

      {(room.phase === 'idle' || room.phase === 'error') && <div className="lobby-scroll">
        <section className="lobby-main" aria-label="Bem-vindo ao AURORA LIVES">
          <div className="hero">
            <div className="hero-copy">
              <span className="hero-kicker"><Sparkles size={15}/> APRESENTANDO O AURORA LIVES</span>
              <h1>Um universo de<br/><em>boas conexões.</em></h1>
              <p>Reúna seus amigos, converse e compartilhe momentos em um espaço que é só de vocês. Sem cadastro, sem complicação.</p>
              <div className="hero-benefits"><span><ShieldCheck size={14}/> Sala privada</span>
                <span><Wifi size={14}/> Conexão direta</span><span><Users size={14}/> Até 10 pessoas</span></div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-ring ring-one"/>
              <div className="hero-ring ring-two"/>
              <div className="hero-ring ring-three"/>
              <div className="hero-star star-one"/>
              <div className="hero-star star-two"/>
              <div className="hero-star star-three"/>
              <span className="hero-aura"/>
              <Crystal size={180} className="hero-crystal"/>
              <span className="art-label">STAY CONNECTED</span>
            </div>
          </div>

          <div className="lobby-section-heading"><div><span className="section-overline">COMECE POR AQUI</span><h2>Como vamos nos conectar?</h2></div><span className="small-muted">Escolha uma opção abaixo</span></div>

          <div className="lobby-actions">
            <section className="action-card action-create">
              <div className="action-card-top"><span className="action-illustration"><Plus size={27}/></span><span className="action-index">01 / CRIAR</span></div>
              <h3>Crie sua sala</h3>
              <p>Abra um espaço privado e compartilhe o código com quem você quiser chamar.</p>
              <button className="action-primary" onClick={() => openRoom('host')} type="button">
                Criar sala agora <ArrowRight size={18}/>
              </button>
              <span className="action-footnote"><LockKeyhole size={13}/> O convite é exclusivo da sua sala</span>
            </section>
            <section className="action-card action-join">
              <div className="action-card-top"><span className="action-illustration"><Link2 size={25}/></span><span className="action-index">02 / ENTRAR</span></div>
              <h3>Entre com um convite</h3>
              <p>Alguém já criou a sala? Insira o código enviado pelo anfitrião.</p>
              <label className="sr-only" htmlFor="invite-code">Código de 16 caracteres da sala</label>
              <div className="invite-field"><Hash size={17}/><input id="invite-code" autoComplete="off" spellCheck={false}
                placeholder="ABCD-EFGH-JKLM-NPQR" value={invite} maxLength={23}
                onChange={event => setInvite(event.target.value.toUpperCase())}/></div>
              <button className="action-secondary" onClick={() => openRoom('guest')} disabled={!normalizeRoomCode(invite)}>
                Entrar na sala <ArrowRight size={17}/>
              </button>
            </section>
          </div>

          {savedInvites.length > 0 && <section className="saved-rooms" aria-label="Convites guardados">
            <div className="saved-rooms-heading"><Bookmark size={17}/><strong>Convites salvos</strong><span>Somente neste dispositivo</span></div>
            <div className="saved-rooms-list">
              {savedInvites.map(item => <div className="saved-room" key={item.code}>
                <span className="saved-room-icon"><Hash size={18}/></span>
                <span className="saved-room-title"><strong>{item.label}</strong><small>{formatRoomCode(item.code)}</small></span>
                <button onClick={() => openRoom('guest', item.code)} className="saved-enter">Entrar <ArrowRight size={15}/></button>
                <button className="saved-delete icon-control" onClick={() => removeSavedInvite(item.code)}
                  aria-label={'Excluir convite ' + item.label} title="Remover convite salvo"><Trash2 size={16}/></button>
              </div>)}
            </div>
            <p>Esses códigos só funcionam enquanto o anfitrião estiver conectado.</p>
          </section>}

          <div className="lobby-bottom">
            <div className="privacy-note"><span className="privacy-icon"><ShieldCheck size={17}/></span>
              <span><strong>Seu espaço continua sendo seu.</strong><small>Sem contas, sem histórico permanente. A comunicação usa WebRTC quando a rede permite.</small></span></div>
            <button className="text-action" onClick={() => setDiagnosticsOpen(value => !value)}
              aria-expanded={diagnosticsOpen}><Gauge size={16}/>{diagnosticsOpen ? 'Ocultar diagnóstico' : 'Diagnóstico do dispositivo'}<ChevronDown size={16}/></button>
          </div>

          {diagnosticsOpen && <section className="compatibility-card">
            <div className="compatibility-heading"><Gauge size={19}/><strong>Compatibilidade do dispositivo</strong><span>Verificação local</span></div>
            <div className="compatibility-grid">
              {[
                { title: 'Conexões WebRTC', ok: support.webRTC },
                { title: 'Microfone', ok: support.microphoneApi },
                { title: 'Compartilhamento de tela', ok: support.screenApi },
                { title: 'Janela flutuante', ok: support.pictureInPicture },
              ].map(entry => <div className="compatibility-item" key={entry.title}><span>{entry.title}</span><strong className={entry.ok ? 'available' : 'not-available'}>
                {entry.ok ? <Check size={14}/> : <X size={14}/>} {entry.ok ? 'Disponível' : 'Indisponível'}
              </strong></div>)}
            </div>
            <p>Essa verificação indica a presença de recursos, não garante permissões ou uma conexão bem-sucedida.</p>
          </section>}
        </section>
      </div>}

      {joining && <section className="connection-wait" aria-live="polite">
        <div className="wait-art"><span className="wait-ripple ripple-one"/><span className="wait-ripple ripple-two"/><Crystal size={108}/></div>
        <span className="section-overline">AURORA SMART CONNECT</span>
        <h2>{room.phase === 'reconnecting' ? 'Restabelecendo a conexão...' : isHost ? 'Criando seu espaço...' : 'Entrando na sala...'}</h2>
        <p>{room.phase === 'reconnecting'
          ? 'Tentativa ' + room.reconnectAttempts + ' de 3. Confira se o anfitrião continua online.'
          : 'Estabelecendo uma conexão WebRTC segura com os participantes.'}</p>
        <div className="wait-progress" aria-hidden="true"><span/></div>
        <button className="quiet-button" onClick={leaveRoom}>Cancelar</button>
      </section>}

      {connected && <>
        <div className="room-toolbar">
          <div className="room-invite">
            <span className="invite-lock"><LockKeyhole size={19}/></span>
            <div><span className="invite-caption">CÓDIGO DA SUA SALA</span><strong title="Selecione para copiar" className="invite-code">{formatRoomCode(room.code)}</strong></div>
          </div>
          <div className="room-invite-actions">
            <button onClick={() => void copyInvite(false)} className="toolbar-button" title="Copiar código">
              {copied ? <Check size={16}/> : <Copy size={16}/>} <span>{copied ? 'Copiado' : 'Copiar'}</span></button>
            <button onClick={() => void copyInvite(true)} className="toolbar-button toolbar-share"><Link2 size={16}/> <span>Compartilhar convite</span></button>
            <button onClick={saveCurrentInvite} className="toolbar-button" title="Salvar código no dispositivo"><Bookmark size={16}/><span>Salvar</span></button>
            <button onClick={leaveRoom} className="toolbar-button toolbar-leave" title="Sair do encontro"><X size={16}/><span>Sair</span></button>
          </div>
        </div>

        <div className={'room-content mobile-view-' + mobileTab}>
          <section className="live-stage" aria-label="Compartilhamento de tela e voz">
            <header className="stage-heading">
              <div className="stage-heading-copy"><span className="section-overline">SEU PALCO</span><h2>Aurora <em>Live</em></h2><p>Este espaço é de vocês.</p></div>
              <span className={'stage-live-pill ' + (broadcasting ? 'streaming' : '')}>
                <span className="status-indicator"/>{broadcasting ? 'TRANSMISSÃO ATIVA' : 'PRONTO PARA TRANSMITIR'}</span>
            </header>

            <div className="stage-screen">
              {room.localScreen && <MediaPlayer stream={room.localScreen} muted label="Sua transmissão"/>}
              {liveStreams.map(item => <MediaPlayer key={item.id} stream={item.stream} muted={false} label={'Transmissão de ' + memberName(item.peerId)}/>)}
              {!broadcasting && <div className="stage-empty">
                <div className="stage-empty-art" aria-hidden="true">
                  <span className="stage-empty-halo"/><Crystal size={86}/><span className="stage-empty-play"><MonitorUp size={21}/></span>
                </div>
                <h3>O palco está pronto.</h3>
                <p>Compartilhe sua tela ou convide alguém para começar uma transmissão.</p>
                <span className="stage-empty-caption"><span className="status-indicator"/> AGUARDANDO TRANSMISSÃO</span>
              </div>}
            </div>

            <div className="broadcast-controls">
              <button className={'broadcast-control ' + (room.microphone ? 'control-on' : '')}
                onClick={() => void toggleMicrophone()} disabled={busyMedia}
                aria-pressed={room.microphone} title={room.microphone ? 'Desligar microfone' : 'Ligar microfone'}>
                <span className="broadcast-control-icon">{room.microphone ? <Mic size={19}/> : <MicOff size={19}/>}</span>
                <span>{room.microphone ? 'Microfone ligado' : 'Ligar microfone'}</span>
              </button>
              <button className={'broadcast-control broadcast-screen ' + (room.screen ? 'control-on' : '')}
                onClick={() => void toggleDisplay()} disabled={busyMedia || isAndroid} aria-pressed={room.screen}
                title={room.screen ? 'Parar compartilhamento' : 'Iniciar compartilhamento'}>
                <span className="broadcast-control-icon">{room.screen ? <VideoOff size={19}/> : <MonitorUp size={19}/>}</span>
                <span>{room.screen ? 'Parar transmissão' : isAndroid ? 'Transmitir tela · em breve' : 'Compartilhar tela'}</span>
              </button>
              <button className={'broadcast-control broadcast-sound ' + (deafened ? 'control-muted' : '')}
                onClick={() => setDeafened(value => !value)} aria-pressed={deafened}
                title={deafened ? 'Voltar a ouvir participantes' : 'Silenciar áudio recebido'}>
                <span className="broadcast-control-icon">{deafened ? <VolumeX size={19}/> : <Volume2 size={19}/>}</span>
                <span>{deafened ? 'Som silenciado' : 'Silenciar áudio'}</span>
              </button>
            </div>

            {isAndroid && <div className="android-screen-notice"><Info size={16}/>
              <span>No Android, você pode assistir às telas compartilhadas pelo Windows ou Linux. A transmissão da própria tela do celular depende de captura nativa e ainda não está disponível.</span>
            </div>}

            <div className="stage-settings">
              <label htmlFor="video-profile"><Gauge size={17}/> Qualidade da transmissão</label>
              <select id="video-profile" value={room.qualityMode} onChange={event => void updateQuality(event.target.value as QualityMode)}>
                <option value="auto">Automático (recomendado)</option>
                <option value="economy">Econômico · 480p30</option>
                <option value="balanced">Equilibrado · 720p30</option>
                <option value="high">Alta qualidade · 1080p30</option>
                <option value="ultra">Máxima qualidade · 1080p60</option>
              </select>
              <span>Perfil: {selectedProfile.name}</span>
            </div>

            {microphoneStreams.length > 0 && <section className="microphone-section" aria-label="Participantes com áudio ativo">
              <span className="section-overline">ÁUDIO DOS PARTICIPANTES</span>
              <div className="microphone-grid">{microphoneStreams.map(item => <AudioListener
                key={item.id} media={item} name={memberName(item.peerId)} muted={deafened}/>)}</div>
            </section>}

            <div className="diagnostics">
              <button className="diagnostics-heading" aria-expanded={diagnosticsOpen}
                onClick={() => setDiagnosticsOpen(value => !value)}>
                <span><Activity size={17}/> Status da conexão <span className="diagnostics-dot"/></span>
                <span>Detalhes <ChevronDown size={17}/></span>
              </button>
              <div className="diagnostics-summary">
                <MiniMetric icon={<Wifi size={16}/>} label="Conexão"
                  value={room.metrics.state === 'connected' ? 'Boa' : room.metrics.state === 'unstable' ? 'Instável' : room.metrics.state === 'connecting' ? 'Negociando' : 'Não medida'}
                  accent={room.metrics.state === 'connected'}/>
                <MiniMetric icon={<Gauge size={16}/>} label="Latência" value={room.metrics.rttMs === null ? '—' : room.metrics.rttMs + ' ms'}/>
                <MiniMetric icon={<Users size={16}/>} label="Pessoas na sala" value={String(memberCount).padStart(2, '0') + ' / 10'}/>
              </div>
              {diagnosticsOpen && <div className="diagnostics-detail">
                <MiniMetric icon={<Activity size={16}/>} label="Saída estimada" value={room.metrics.estimatedUplinkMbps === null ? 'Indisponível' : room.metrics.estimatedUplinkMbps + ' Mbps'}/>
                <MiniMetric icon={<MonitorUp size={16}/>} label="Captura"
                  value={room.metrics.videoWidth && room.metrics.videoHeight
                    ? room.metrics.videoWidth + ' × ' + room.metrics.videoHeight + (room.metrics.videoFps ? ' · ' + Math.round(room.metrics.videoFps) + ' FPS' : '')
                    : 'Não iniciada'}/>
                <p>{room.warning || 'Os dados são estimativas de uma conexão WebRTC, não um teste de velocidade.'}</p>
              </div>}
            </div>
          </section>

          <section className="conversation-panel" aria-label="Chat da sala">
            <header className="conversation-header"><span className="conversation-icon"><MessageCircle size={18}/></span>
              <div><strong>Conversa da sala</strong><small>Mensagens apenas durante o encontro</small></div>
              <span className="chat-privacy"><LockKeyhole size={13}/> Privado</span></header>
            <div className="messages-list" ref={messageList} role="log" aria-label="Mensagens da sala" aria-live="polite">
              {room.messages.length === 0 && <div className="empty-chat"><span className="empty-chat-icon"><MessageCircle size={24}/></span>
                <strong>A conversa começa aqui.</strong><span>Envie uma mensagem para dar as boas-vindas.</span></div>}
              {room.messages.map(item => <article className="chat-message" key={item.id}>
                <Avatar name={item.author} size="small" own={item.senderId === room.localId}/>
                <div className="chat-message-content"><div className="chat-message-meta"><strong>{item.author}</strong><time dateTime={new Date(item.sentAt).toISOString()}>
                  {new Date(item.sentAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</time></div>
                  <p>{item.text}</p></div>
              </article>)}
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="message-text">Escrever mensagem</label>
              <textarea rows={1} id="message-text" maxLength={2000} value={message}
                onChange={event => setMessage(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Escreva uma mensagem..."/>
              <button type="submit" className="chat-send" disabled={!message.trim()} aria-label="Enviar mensagem" title="Enviar mensagem"><Send size={19}/></button>
            </form>
            <p className="composer-hint"><ShieldCheck size={13}/> Conversa temporária, sem histórico em nuvem</p>
          </section>

          <section className="mobile-members-panel" aria-label="Participantes da sala">
            <div className="mobile-members-heading"><Users size={19}/>
              <div><strong>Pessoas na sala</strong><small>{memberCount} de 10 participantes</small></div>
              <span className="status-indicator"/>
            </div>
            <div className="mobile-members-list">
              {room.members.map(member => <div className="mobile-member" key={member.id}>
                <Avatar name={member.name} own={member.id === room.localId}/>
                <div><strong>{member.name}{member.id === room.localId ? ' (você)' : ''}</strong>
                  <small>{member.host ? 'Anfitrião' : 'Participante'} · Conectado</small></div>
                <span className="online-pin" aria-label="Conectado"/>
              </div>)}
            </div>
            <p>O anfitrião precisa manter a sala aberta. Compartilhe o código com seus amigos para que possam entrar.</p>
          </section>
        </div>
      </>}

      <UpdatePrompt updater={updater} connected={connected}/>
      {(feedback || room.error) && <div className={'aurora-toast ' + (room.error ? 'toast-error' : '')} role="status">
        <span className="toast-icon">{room.error ? <Info size={17}/> : <Check size={17}/>}</span>
        <p>{room.error || feedback}</p>
        <button onClick={() => { setFeedback(''); if (room.phase === 'error') leaveRoom(); }} aria-label="Fechar aviso" title="Fechar"><X size={17}/></button>
      </div>}

      {isAndroid && <nav className="mobile-bottom-nav" aria-label="Navegação Android">
        {connected ? <>
          <button className={mobileTab === 'stage' ? 'selected' : ''} onClick={() => setMobileTab('stage')}
            aria-current={mobileTab === 'stage' ? 'page' : undefined}><MonitorUp size={20}/><span>Transmissão</span></button>
          <button className={mobileTab === 'chat' ? 'selected' : ''} onClick={() => setMobileTab('chat')}
            aria-current={mobileTab === 'chat' ? 'page' : undefined}>
            <MessageCircle size={20}/><span>Chat</span>{room.messages.length > 0 && <i aria-label={room.messages.length + ' mensagens'} />}</button>
          <button className={mobileTab === 'members' ? 'selected' : ''} onClick={() => setMobileTab('members')}
            aria-current={mobileTab === 'members' ? 'page' : undefined}><Users size={20}/><span>Pessoas</span></button>
          <button onClick={() => setSettingsOpen(true)} aria-label="Abrir configurações Android">
            <Settings2 size={20}/><span>Ajustes</span></button>
        </> : <>
          <button className="selected" onClick={() => { setSidebarOpen(false); document.querySelector('.lobby-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <Home size={20}/><span>Início</span></button>
          <button onClick={() => setDiagnosticsOpen(value => !value)} aria-pressed={diagnosticsOpen}>
            <Gauge size={20}/><span>Conexão</span></button>
          <button onClick={() => setSettingsOpen(true)} aria-label="Abrir configurações Android">
            <Settings2 size={20}/><span>Ajustes</span></button>
        </>}
      </nav>}
    </main>

    {inspectorOpen && <button type="button" className="inspector-scrim" aria-label="Fechar informações" onClick={() => setInspectorOpen(false)}/>}
    <aside className={'inspector-panel ' + (inspectorOpen ? 'inspector-visible' : '')} aria-label="Painel Aurora">
      <header className="inspector-header"><span className="inspector-header-icon"><Activity size={18}/></span>
        <strong>Central Aurora</strong><button className="inspector-close icon-control" onClick={() => setInspectorOpen(false)} aria-label="Fechar informações"><X size={18}/></button></header>
      <div className="inspector-content">
        <div className="inspector-art"><span className="inspector-orbit"/><span className="inspector-orbit orbit-alt"/><Crystal size={118}/></div>
        <div className="inspector-kicker"><Sparkles size={14}/> BEM-VINDO AO SEU UNIVERSO</div>
        <h2>Mais perto.<br/><em>Mais conectado.</em></h2>
        <p>Um espaço simples para encontrar seus amigos, conversar e compartilhar experiências.</p>
        <div className="inspector-separator"/>
        <div className="inspector-facts">
          <MiniMetric icon={<ShieldCheck size={17}/>} label="Privacidade" value="Por convite" accent/>
          <MiniMetric icon={<Users size={17}/>} label="Participantes" value={String(memberCount).padStart(2, '0') + ' / 10'}/>
          <MiniMetric icon={<Headphones size={17}/>} label="Voz" value="Experimental"/>
          <MiniMetric icon={<MonitorUp size={17}/>} label="Compartilhar tela" value="Experimental"/>
          {connected && <MiniMetric icon={<Gauge size={17}/>} label="Latência"
            value={room.metrics.rttMs === null ? 'A verificar' : room.metrics.rttMs + ' ms'}/>}
        </div>
        {connected && <div className="inspector-members">
          <button onClick={() => setMembersExpanded(value => !value)} aria-expanded={membersExpanded}>
            <Users size={16}/> Pessoas conectadas <ChevronDown size={16}/>
          </button>
          {membersExpanded && room.members.map(member => <div className="inspector-member" key={member.id}>
            <Avatar name={member.name} size="small" own={member.id === room.localId}/>
            <span>{member.name}</span>{member.host && <span className="host-tag">Host</span>}
            <span className="online-pin"/>
          </div>)}
        </div>}
        <div className="inspector-tip"><Sparkles size={17}/><span>{connected
          ? 'Dica: cada participante pode compartilhar sua própria tela.'
          : 'Dica: crie uma sala e envie o convite pelo WhatsApp.'}</span></div>
      </div>
      <div className="inspector-footer"><span className="footer-orb"/><span>FEITO PARA CONECTAR PESSOAS</span></div>
    </aside>

    {settingsOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        <header className="dialog-heading"><span className="dialog-heading-symbol"><Settings2 size={22}/></span>
          <div><span className="section-overline">PERSONALIZE SEU ESPAÇO</span><h2 id="settings-heading">Configurações</h2></div>
          <button className="dialog-close icon-control" aria-label="Fechar configurações" onClick={() => setSettingsOpen(false)} autoFocus><X size={20}/></button>
        </header>
        <div className="dialog-body">
          <label className="dialog-field-label" htmlFor="profile-name">Seu nome de exibição</label>
          <div className="nickname-input"><Avatar name={cleanName(nickname)} size="small"/><input id="profile-name" value={nickname} maxLength={32}
            onChange={event => updateNickname(event.target.value)} placeholder="Como devemos chamar você?"/></div>
          {connected && <p className="field-helper">A alteração de nome será aplicada na próxima sala.</p>}
          <label className="dialog-field-label">Aparência</label>
          <div className="theme-selector" role="group" aria-label="Tema do aplicativo">
            <button className={theme === 'dark' ? 'selected' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={17}/> Escuro</button>
            <button className={theme === 'light' ? 'selected' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={17}/> Claro</button>
            <button className={theme === 'system' ? 'selected' : ''} aria-pressed={theme === 'system'} onClick={() => setTheme('system')}><Settings2 size={17}/> Sistema</button>
          </div>
          <UpdateSettings updater={updater} connected={connected}/>
          <div className="privacy-disclaimer"><LockKeyhole size={19}/><p>Esta versão usa apelidos locais, não contas. Quem souber o código poderá entrar na sala enquanto o anfitrião estiver online.</p></div>
        </div>
        <footer className="dialog-footer"><span>AURORA LIVES · v0.0.7</span>
          <button onClick={() => setSettingsOpen(false)}>Concluído <ArrowRight size={17}/></button></footer>
      </section>
    </div>}
  </div>;
}
