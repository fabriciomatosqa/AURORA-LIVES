import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Activity, ArrowRight, Check, ChevronDown, Copy, Hash,
  Headphones, Home, Info, Link2, LockKeyhole, MessageCircle, Mic, MicOff,
  MonitorUp, Moon, Plus, RadioTower, Send, Settings, ShieldCheck,
  Sparkles, Sun, Users, VideoOff, Wifi, X,
} from 'lucide-react';
import { RoomSession, emptyRoom, type RemoteMedia, type RoomSnapshot } from './p2p/session';
import { cleanName, formatRoomCode, normalizeRoomCode } from './p2p/protocol';
import './p2p.css';

function fromStorage(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function Crystal({ size = 42 }: { size?: number }) {
  return <img className="crystal" src="/aurora-mark.webp" alt="Emblema cristalino AURORA" width={size} height={size} />;
}
function StreamVideo({ stream, muted, label }: { stream: MediaStream; muted: boolean; label: string }) {
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!element.current) return;
    element.current.srcObject = stream;
    void element.current.play().catch(() => { /* user can press Play */ });
    return () => { if (element.current) element.current.srcObject = null; };
  }, [stream]);
  return <div className="video-card">
    <video ref={element} autoPlay playsInline muted={muted} controls aria-label={label}/>
    <span className="video-label"><MonitorUp size={14}/> {label}</span>
  </div>;
}
function RemoteAudio({ media, name }: { media: RemoteMedia; name: string }) {
  const element = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!element.current) return;
    element.current.srcObject = media.stream;
    void element.current.play().catch(() => { /* controls allow user start */ });
    return () => { if (element.current) element.current.srcObject = null; };
  }, [media.stream]);
  return <div className="audio-card">
    <span className="audio-avatar">{name.slice(0, 1).toUpperCase()}</span>
    <div><strong>{name}</strong><small>Áudio recebido</small></div>
    <audio autoPlay controls ref={element} aria-label={'Áudio de ' + name}/>
  </div>;
}
export default function App() {
  const [room, setRoom] = useState<RoomSnapshot>(emptyRoom);
  const [nickname, setNickname] = useState(() => fromStorage('aurora.nickname', 'Visitante'));
  const [invite, setInvite] = useState('');
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState(false);
  const [theme, setTheme] = useState(() => fromStorage('aurora.theme', 'dark'));
  const [busyMedia, setBusyMedia] = useState(false);
  const [membersExpanded, setMembersExpanded] = useState(true);
  const session = useRef<RoomSession | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const connected = room.phase === 'connected';
  const host = room.role === 'host';
  const remoteVideo = room.remoteMedia.filter(m => m.kind === 'screen');
  const remoteAudio = room.remoteMedia.filter(m => m.kind === 'microphone');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('aurora.theme', theme); } catch { /* no storage */ }
  }, [theme]);
  useEffect(() => () => session.current?.stop(), []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [room.messages]);

  function openRoom(mode: 'host' | 'guest') {
    if (typeof window.RTCPeerConnection === 'undefined') {
      setFeedback('Este sistema não disponibiliza WebRTC. Tente outro ambiente.');
      return;
    }
    setFeedback('');
    setCopied(false);
    const code = mode === 'host' ? RoomSession.newCode() : normalizeRoomCode(invite);
    if (!code) { setFeedback('Informe o código de 16 caracteres recebido do anfitrião.'); return; }
    session.current?.stop();
    const current = new RoomSession(cleanName(nickname), next => setRoom(next));
    session.current = current;
    if (mode === 'host') current.startHosting(code);
    else current.startJoining(code);
  }

  function leave() {
    session.current?.stop();
    session.current = null;
    setRoom({ ...emptyRoom });
    setText('');
    setFeedback('');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formatRoomCode(room.code));
      setCopied(true);
      setFeedback('Código copiado. Envie-o somente a quem você deseja convidar.');
    } catch {
      setFeedback('Não foi possível copiar automaticamente. Selecione o código exibido e copie.');
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.current?.send(text)) {
      setText('');
      setFeedback('');
    } else if (text.trim()) setFeedback('Não foi possível enviar. Verifique a conexão P2P.');
  }

  async function toggleMicrophone() {
    setBusyMedia(true); setFeedback('');
    try {
      if (room.microphone) session.current?.disableMicrophone();
      else await session.current?.enableMicrophone();
    } catch (e) {
      setFeedback('Microfone indisponível: ' + (e instanceof Error ? e.message : 'verifique as permissões.'));
    } finally { setBusyMedia(false); }
  }

  async function toggleDisplay() {
    setBusyMedia(true); setFeedback('');
    try {
      if (room.screen) session.current?.stopScreen();
      else await session.current?.shareScreen();
    } catch (e) {
      setFeedback('Não foi possível compartilhar: ' + (e instanceof Error ? e.message : 'verifique as permissões.'));
    } finally { setBusyMedia(false); }
  }

  function updateNickname(value: string) {
    setNickname(value);
    try { localStorage.setItem('aurora.nickname', value); } catch { /* no storage */ }
  }

  const nameOf = (peerId: string) => room.members.find(m => m.id === peerId)?.name || 'Participante';

  return <div className="shell p2p-shell">
    <nav className="rail" aria-label="AURORA LIVES">
      <button className="brand-square" title="Início" onClick={() => connected ? undefined : setFeedback('')}><Crystal size={51}/></button>
      <span className="separator"/>
      <button className="rail-button chosen" title="Conexões" aria-label="Conexões"><Home size={22}/></button>
      <button className="rail-button" disabled title="Comunidades públicas em breve"><Plus size={22}/></button>
      <div className="grow"/>
      <button className="rail-button" onClick={() => setSettings(true)} title="Configurações"><Settings size={21}/></button>
    </nav>

    <aside className="channels">
      <div className="brand-row">
        <div className="brand-tile"><Crystal size={31}/></div>
        <div><strong>AURORA</strong><small>LIVES • Conexão direta</small></div>
        <ChevronDown size={16}/>
      </div>
      <div className="channel-scroll">
        <div className="section-title">MEU ESPAÇO</div>
        <div className="channel selected"><Home size={18}/><span>{connected ? 'Encontro privado' : 'Início'}</span></div>
        <div className="section-title section-split">CANAIS DE COMUNICAÇÃO</div>
        <div className="channel selected"><Hash size={18}/><span>conversa-p2p</span></div>
        <div className="channel"><RadioTower size={18}/><span>voz e transmissão</span></div>
        <div className="section-title section-split">PARTICIPANTES <span className="coming-label">{room.members.length}/{10}</span></div>
        {room.members.map(m => <div className="participant" key={m.id}>
          <div className="avatar">{m.name.slice(0, 1).toUpperCase()}</div>
          <span>{m.name}{m.id === room.localId ? ' (você)' : ''}</span>
          {m.host && <span title="Anfitrião">★</span>}
        </div>)}
        {!connected && <p className="nav-help">Crie uma sala ou use um convite para conversar pela internet, sem cadastro.</p>}
      </div>
      <div className="connection">
        <span className={'dot ' + (connected ? 'on' : '')}/>
        <div><strong>{connected ? 'Conexão P2P ativa' : room.phase === 'connecting' ? 'Conectando...' : 'Sem sala ativa'}</strong><small>WebRTC • Sem servidor pago</small></div>
        <Wifi size={16}/>
      </div>
      <div className="account">
        <div className="avatar">{cleanName(nickname).slice(0, 1).toUpperCase()}</div>
        <div><strong>{cleanName(nickname)}</strong><small>Sem conta • Visitante</small></div>
        <button onClick={() => setSettings(true)} aria-label="Configurações"><Settings size={19}/></button>
      </div>
    </aside>

    <main className="main p2p-main">
      <header className="topbar">
        <Hash className="teal" size={23}/>
        <div><strong>{connected ? 'sala-privada' : 'boas-vindas'}</strong><small>{connected ? 'Mensagens e mídia diretamente entre os participantes' : 'Crie ou entre em uma sala de comunicação'}</small></div>
        <span className="flex-grow"/>
        <span className="version"><span className={'dot ' + (connected ? 'on' : '')}/> PRÉVIA 0.0.2</span>
      </header>

      {(room.phase === 'idle' || room.phase === 'error') && <section className="p2p-lobby">
        <div className="welcome-logo"><Crystal size={111}/></div>
        <div className="eyebrow">✦ &nbsp; SUA CONEXÃO, SEU ESPAÇO</div>
        <h1>Conexões que <em>brilham.</em></h1>
        <p>Crie uma sala privada e compartilhe o código com seus amigos. Todos usam o mesmo AURORA LIVES — sem cadastro e sem contratar servidor.</p>
        <div className="lobby-panels">
          <div className="lobby-panel">
            <div className="panel-symbol"><Sparkles size={24}/></div>
            <h2>Criar um encontro</h2>
            <p>Abra uma nova sala e convide até 9 pessoas. O encontro funciona enquanto você estiver conectado.</p>
            <button className="primary-action" onClick={() => openRoom('host')}><Plus size={19}/> Criar sala <ArrowRight size={17}/></button>
          </div>
          <div className="lobby-panel">
            <div className="panel-symbol violet"><Link2 size={24}/></div>
            <h2>Entrar em uma sala</h2>
            <p>Recebeu um código? Digite aqui para conectar-se diretamente ao anfitrião.</p>
            <label htmlFor="room-invite">Código do convite</label>
            <input id="room-invite" value={invite} maxLength={23} onChange={e => setInvite(e.target.value.toUpperCase())}
              placeholder="ABCD-EFGH-JKLM-NPQR" autoComplete="off" spellCheck={false}/>
            <button className="secondary-action" onClick={() => openRoom('guest')} disabled={!normalizeRoomCode(invite)}>Entrar na sala <ArrowRight size={17}/></button>
          </div>
        </div>
        <p className="connection-note"><ShieldCheck size={16}/> Dados por WebRTC. O serviço gratuito PeerJS apenas apresenta os usuários; conexões restritivas podem precisar de TURN.</p>
      </section>}

      {room.phase === 'connecting' && <section className="p2p-wait">
        <div className="loading-orb"><Crystal size={92}/></div>
        <h2>{host ? 'Preparando seu encontro...' : 'Procurando a sala...'}</h2>
        <p>Conectando ao serviço gratuito de sinalização e negociando o canal direto.</p>
        <button className="secondary-action" onClick={leave}>Cancelar</button>
      </section>}

      {connected && <>
        <div className="room-identity">
          <div className="room-id-info"><LockKeyhole size={17}/><div><small>CONVITE PRIVADO</small><strong>{formatRoomCode(room.code)}</strong></div></div>
          <button onClick={() => void copyCode()} className="copy-code">{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? 'Copiado' : 'Copiar código'}</button>
          <button className="leave-btn" onClick={leave}>Sair da sala <X size={16}/></button>
        </div>
        <div className="p2p-room-scroll">
          <section className="media-panel">
            <div className="media-heading"><div><span className="eyebrow">AO VIVO • WEBRTC</span><h2>Compartilhe o momento.</h2></div><span className="mini-pill"><Users size={15}/>{room.members.length} conectado(s)</span></div>
            <div className="media-buttons">
              <button className={'media-btn ' + (room.microphone ? 'is-active' : '')} onClick={() => void toggleMicrophone()} disabled={busyMedia}>{room.microphone ? <Mic size={18}/> : <MicOff size={18}/>}{room.microphone ? 'Desligar microfone' : 'Ativar microfone'}</button>
              <button className={'media-btn ' + (room.screen ? 'is-active' : '')} onClick={() => void toggleDisplay()} disabled={busyMedia}>{room.screen ? <VideoOff size={18}/> : <MonitorUp size={18}/>}{room.screen ? 'Parar transmissão' : 'Compartilhar tela'}</button>
            </div>
            <div className="screen-wall">
              {room.localScreen && <StreamVideo stream={room.localScreen} muted label="Sua transmissão"/>}
              {remoteVideo.map(media => <StreamVideo key={media.id} stream={media.stream} muted={false} label={'Tela de ' + nameOf(media.peerId)}/>)}
              {!room.localScreen && remoteVideo.length === 0 && <div className="empty-screen">
                <div className="screen-icon"><MonitorUp size={35}/></div>
                <strong>Nenhuma transmissão ativa</strong>
                <span>Qualquer participante pode compartilhar a tela diretamente com os demais.</span>
              </div>}
            </div>
            {remoteAudio.length > 0 && <div className="audio-list">
              {remoteAudio.map(media => <RemoteAudio key={media.id} media={media} name={nameOf(media.peerId)}/>)}
            </div>}
            <p className="media-disclaimer">Compartilhamento em fase experimental: depende das permissões do sistema. Com 5–10 pessoas, o upload P2P pode limitar a resolução e o FPS.</p>
          </section>

          <section className="room-chat">
            <div className="chat-header"><MessageCircle size={17}/><strong>Conversa em tempo real</strong><small>Mensagens apenas enquanto a sala está aberta</small></div>
            {room.messages.length === 0 && <div className="no-messages">Envie a primeira mensagem para começar a conversa.</div>}
            <div className="p2p-messages" role="log" aria-label="Mensagens da sala">
              {room.messages.map(message => <article className="message" key={message.id}>
                <div className="avatar">{message.author.charAt(0).toUpperCase()}</div>
                <div><header><strong>{message.author}</strong><time dateTime={new Date(message.sentAt).toISOString()}>{new Date(message.sentAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></header><p>{message.text}</p></div>
              </article>)}
              <div ref={bottom}/>
            </div>
          </section>
        </div>
        <div className="write-area">
          <form className="write" onSubmit={sendMessage}>
            <MessageCircle size={19} className="compose-icon"/>
            <label htmlFor="composer" className="sr-only">Mensagem</label>
            <textarea id="composer" rows={1} maxLength={2000} value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              placeholder="Enviar mensagem para a sala privada"/>
            <button className="send" aria-label="Enviar mensagem" disabled={!text.trim()}><Send size={18}/></button>
          </form>
          <small><ShieldCheck size={13}/> Comunicação P2P • Sem histórico permanente • Sem necessidade de conta</small>
        </div>
      </>}

      {(feedback || room.error || (connected && room.warning)) && <div className={'room-toast ' + (room.error || feedback ? 'toast-error' : '')} role="status">
        <Info size={16}/><span>{room.error || feedback || room.warning}</span>
        <button aria-label="Fechar aviso" onClick={() => { setFeedback(''); if (room.phase === 'error') leave(); }}><X size={16}/></button>
      </div>}
    </main>

    <aside className="right p2p-side">
      <header><Activity size={19}/><strong>Central Aurora</strong></header>
      <div className="right-cover"><Crystal size={100}/></div>
      <div className="right-copy">
        <span className="eyebrow">CONEXÃO SEM MENSALIDADE</span>
        <h2>Seu espaço.<br/><em>Sua liberdade.</em></h2>
        <p>O serviço gratuito permite encontrar o outro computador. Texto, voz e tela são enviados diretamente por WebRTC quando a rede permite.</p>
        <div className="division"/>
        <div className="metric"><span><ShieldCheck size={17}/>Sala privada</span><strong className="ready">Por convite</strong></div>
        <div className="metric"><span><Users size={17}/>Participantes</span><strong>{room.members.length}/10</strong></div>
        <div className="metric"><span><Headphones size={17}/>Voz P2P</span><strong>Experimental</strong></div>
        <div className="metric"><span><MonitorUp size={17}/>Transmissão</span><strong>Experimental</strong></div>
        {connected && <div className="right-members">
          <button onClick={() => setMembersExpanded(p => !p)}><Users size={16}/> Quem está na sala <ChevronDown size={16}/></button>
          {membersExpanded && room.members.map(m => <div className="right-member" key={m.id}><span className="dot on"/>{m.name}{m.host && ' ★'}</div>)}
        </div>}
      </div>
      <footer><Sparkles size={17}/> Feito para conectar pessoas.</footer>
    </aside>

    {settings && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setSettings(false); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header><div><span className="eyebrow">PREFERÊNCIAS</span><h2 id="settings-title">Configurações</h2></div><button onClick={() => setSettings(false)} aria-label="Fechar configurações"><X/></button></header>
        <label htmlFor="nickname">Seu apelido (não é uma conta)</label>
        <input id="nickname" maxLength={32} value={nickname} onChange={e => updateNickname(e.target.value)}/>
        {connected && <p className="settings-help">A alteração de apelido será aplicada na próxima sala.</p>}
        <label>Aparência</label>
        <div className="themes"><button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={16}/> Escuro</button><button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={16}/> Claro</button></div>
        <p className="notice"><LockKeyhole size={17}/> Não compartilhe o código publicamente: qualquer pessoa que o possua poderá entrar. A sala termina quando o anfitrião sai.</p>
        <button className="done" onClick={() => setSettings(false)}>Concluído <ArrowRight size={17}/></button>
      </section>
    </div>}
  </div>;
}
