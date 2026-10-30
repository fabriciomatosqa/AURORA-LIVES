import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Activity,ArrowRight,Bell,ChevronDown,Hash,Headphones,Home,MessageCircle,Mic,MonitorUp,Plus,RadioTower,Send,Settings,ShieldCheck,Sparkles,Volume2,Wifi,WifiOff,X} from 'lucide-react';
import {addRoom,health,history,publish,rooms,stream,type Message,type Room} from './api';

function saved(key:string,fallback:string){try{return localStorage.getItem(key)||fallback}catch{return fallback}}
function ordered(previous:Message[],added:Message[]){const known=new Map<string,Message>();[...previous,...added].forEach(m=>known.set(m.id,m));return [...known.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt))}
function Crystal({size=42}:{size?:number}){return <img src="/aurora-mark.png" alt="Logo cristalina AURORA" className="crystal" width={size} height={size}/>}

export default function App(){
 const [channels,setChannels]=useState<Room[]>([]);
 const [active,setActive]=useState('geral');
 const [items,setItems]=useState<Message[]>([]);
 const [online,setOnline]=useState(false);
 const [error,setError]=useState('');
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [creating,setCreating]=useState(false);
 const [newName,setNewName]=useState('');
 const [settings,setSettings]=useState(false);
 const [nickname,setNickname]=useState(()=>saved('aurora.nickname','Visitante'));
 const [theme,setTheme]=useState(()=>saved('aurora.theme','dark'));
 const bottom=useRef<HTMLDivElement>(null);
 const room=channels.find(c=>c.id===active);

 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('aurora.theme',theme)}catch{/* no localStorage */}},[theme]);
 const refresh=useCallback(async()=>{try{await health();const list=await rooms();setChannels(list);setOnline(true);setError('')}catch{setOnline(false);setError('API local desconectada. Inicie o servidor Go para conversar.')}},[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),5000);return ()=>clearInterval(timer)},[refresh]);
 useEffect(()=>{if(!online)return;let valid=true;setItems([]);void history(active).then(list=>{if(valid)setItems(prev=>ordered(prev,list))}).catch(()=>{if(valid)setError('Erro ao carregar mensagens.')});const source=stream(active);
 const handler=(e:Event)=>{try{const msg=JSON.parse((e as MessageEvent<string>).data) as Message;if(valid)setItems(prev=>ordered(prev,[msg]))}catch{/* ignore invalid event */}};
 source.addEventListener('message',handler);return ()=>{valid=false;source.removeEventListener('message',handler);source.close()}},[online,active]);
 useEffect(()=>bottom.current?.scrollIntoView({block:'end'}),[items]);
 async function send(e:FormEvent){e.preventDefault();if(!online||busy||!draft.trim())return;setBusy(true);try{const msg=await publish(active,nickname.trim()||'Visitante',draft.trim());setItems(prev=>ordered(prev,[msg]));setDraft('');setError('')}catch{setError('Falha ao enviar mensagem.')}finally{setBusy(false)}}
 async function create(e:FormEvent){e.preventDefault();if(!newName.trim())return;try{const result=await addRoom(newName.trim());setChannels(prev=>[...prev,result]);setActive(result.id);setNewName('');setCreating(false)}catch{setError('Não foi possível criar o canal.')}}
 function changeName(value:string){setNickname(value);try{localStorage.setItem('aurora.nickname',value)}catch{/* unavailable */}}
 return <div className="shell">
  <nav className="rail" aria-label="Espaços"><button className="brand-square" title="Início" onClick={()=>setActive('geral')}><Crystal size={51}/></button><span className="separator"/><button className="rail-button chosen" onClick={()=>setActive('geral')} title="Início"><Home/></button><button className="rail-button" disabled title="Comunidades disponíveis em breve"><Plus/></button><div className="grow"/><button className="rail-button" onClick={()=>setSettings(true)} title="Configurações"><Settings/></button></nav>
  <aside className="channels"><div className="brand-row"><div className="brand-tile"><Crystal size={31}/></div><div><strong>AURORA</strong><small>Comunidade de testes</small></div><ChevronDown size={16}/></div>
   <div className="channel-scroll"><div className="section-title">ÁREA DE TRABALHO</div><button className="channel" onClick={()=>setActive('geral')}><Home size={17}/>Visão geral</button>
    <div className="section-title section-split">CANAIS DE TEXTO <button title="Criar canal de texto" aria-label="Criar canal" disabled={!online} onClick={()=>setCreating(v=>!v)}><Plus size={17}/></button></div>
    {channels.map(c=><button key={c.id} className={'channel '+(active===c.id?'selected':'')} onClick={()=>setActive(c.id)}><Hash size={18}/><span>{c.name}</span></button>)}
    {creating&&<form className="create-room" onSubmit={e=>void create(e)}><label htmlFor="room-name">Novo canal</label><input id="room-name" value={newName} onChange={e=>setNewName(e.target.value)} maxLength={48} placeholder="Nome do canal" autoFocus/><div><button type="button" onClick={()=>setCreating(false)}>Cancelar</button><button type="submit" disabled={!newName.trim()}>Criar</button></div></form>}
    <div className="section-title section-split">CANAIS DE VOZ <span className="coming-label">EM BREVE</span></div>
    <button disabled title="Voz: próximo marco" className="channel"><Volume2 size={18}/>Sala de voz</button>
    <button disabled title="WebRTC: próximo marco" className="channel"><RadioTower size={18}/>Compartilhar tela</button>
   </div><div className="connection"><span className={'dot '+(online?'on':'')}/><div><strong>{online?'Servidor conectado':'Servidor desconectado'}</strong><small>Ambiente local • v0.0.1</small></div>{online?<Wifi size={16}/>:<WifiOff size={16}/>}</div>
   <div className="account"><div className="avatar">{nickname.trim().charAt(0).toUpperCase()||'V'}</div><div><strong>{nickname||'Visitante'}</strong><small>Perfil de teste</small></div><button onClick={()=>setSettings(true)} aria-label="Configurações"><Settings size={19}/></button></div>
  </aside>
  <main className="main"><header className="topbar"><Hash className="teal" size={23}/><div><strong>{room?.name||'geral'}</strong><small>Um espaço para boas conversas</small></div><span className="flex-grow"/><span className="version"><span className="dot on"/> PRÉVIA 0.0.1</span><button disabled title="Notificações em breve"><Bell size={19}/></button></header>
   <div className="timeline"><div className="welcome"><div className="welcome-logo"><Crystal size={110}/></div><div className="eyebrow">✦ &nbsp; O FUTURO DA SUA COMUNIDADE</div><h1>Conexões que <em>brilham.</em></h1><p>Bem-vindo ao <strong>AURORA LIVES</strong>. Um novo espaço para criar, conversar e compartilhar experiências com quem importa.</p>
    <div className="highlights"><div className="highlight"><span className="highlight-icon cyan"><MessageCircle size={19}/></span><div><strong>Conversas em tempo real</strong><small>Disponível nesta prévia local</small></div><ArrowRight size={16}/></div><div className="highlight future"><span className="highlight-icon purple"><Headphones size={19}/></span><div><strong>Voz e chamadas</strong><small>Em desenvolvimento</small></div></div><div className="highlight future"><span className="highlight-icon blue"><MonitorUp size={19}/></span><div><strong>Lives em 1080p60</strong><small>Meta para próxima etapa</small></div></div></div><div className="division"/><div className="chat-begin"><Hash size={16}/>Início da conversa em <strong>#{room?.name||'geral'}</strong></div>
   </div><div className="messages" role="log">{items.map(m=><article className="message" key={m.id}><div className="avatar">{m.author.charAt(0).toUpperCase()}</div><div><header><strong>{m.author}</strong><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></header><p>{m.text}</p></div></article>)}<div ref={bottom}/></div></div>
   <div className="write-area">{error&&<div role="alert" className="error"><WifiOff size={16}/>{error}<button onClick={()=>void refresh()}>Reconectar</button></div>}<form className="write" onSubmit={e=>void send(e)}><button disabled title="Anexos em breve"><Plus size={20}/></button><label htmlFor="composer" className="sr-only">Mensagem</label><textarea id="composer" rows={1} maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}} placeholder={online?'Enviar mensagem para #'+(room?.name||'geral'):'Conecte o servidor para conversar'} disabled={!online}/><button className="send" title="Enviar" aria-label="Enviar" disabled={!online||!draft.trim()||busy} type="submit"><Send size={18}/></button></form><small><ShieldCheck size={13}/> Prévia local: mensagens não são persistidas</small></div>
  </main>
  <aside className="right"><header><Activity size={19}/><strong>Central Aurora</strong></header><div className="right-cover"><Crystal size={100}/></div><div className="right-copy"><span className="eyebrow">SUA NOVA EXPERIÊNCIA</span><h2>O seu espaço.<br/><em>Suas conexões.</em></h2><p>Estamos construindo algo especial. Esta é a primeira fundação do AURORA LIVES.</p><div className="division"/><div className="metric"><span><MessageCircle size={17}/>Chat local</span><strong className="ready">Disponível</strong></div><div className="metric"><span><Mic size={17}/>Áudio e vídeo</span><strong>Planejado</strong></div><div className="metric"><span><MonitorUp size={17}/>Compartilhamento</span><strong>Planejado</strong></div></div><footer><Sparkles size={17}/> Feito para conectar pessoas.</footer></aside>
  {settings&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSettings(false)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><div><span className="eyebrow">PREFERÊNCIAS</span><h2 id="settings-title">Configurações</h2></div><button aria-label="Fechar" onClick={()=>setSettings(false)}><X/></button></header><label htmlFor="nickname">Apelido neste computador</label><input id="nickname" maxLength={32} value={nickname} onChange={e=>changeName(e.target.value)}/><label>Aparência</label><div className="themes"><button className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')}>Escuro</button><button className={theme==='light'?'active':''} onClick={()=>setTheme('light')}>Claro</button></div><p className="notice"><ShieldCheck size={17}/> Ainda não existem contas. Seu apelido é local e não comprova identidade.</p><button className="done" onClick={()=>setSettings(false)}>Concluído <ArrowRight size={17}/></button></section></div>}
 </div>
}
