import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Activity, ArrowDown, ArrowUp, Clock3, Gauge, Globe, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { KEY, readHistory, addHistory, quality, number, type SpeedRow, type SpeedResult } from './speedHistory';
import { SPEED_TICKS, gaugeFraction, dialArc, dialPoint } from './speedGauge';

type SpeedProgress = {
  phase: string;
  downloadMbps: number | null;
  uploadMbps: number | null;
  pingMs: number | null;
  jitterMs: number | null;
  publicIp: string | null;
};
const PROGRESS_EVENT = 'aurora:connection-progress';
const validRate = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0;
const display = (n: number | null | undefined) => validRate(n) ? number(n) : '—';
const detailed = (n: number | null | undefined) =>
  validRate(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

function storedHistory(): SpeedRow[] {
  try { return readHistory(localStorage.getItem(KEY)); } catch { return []; }
}

function Speedometer({ rate, label, active }: { rate: number | null; label: string; active: boolean }) {
  const fraction = gaugeFraction(rate);
  const needle = dialPoint(fraction, 92);
  return <div className={'speedometer' + (active ? ' is-running' : '')}>
    <svg viewBox="0 0 320 260" className="speedometer-svg" role="img" aria-label={'Velocímetro: ' + label + ', ' + detailed(rate) + ' Mbps'}>
      <defs>
        <linearGradient id="aurora-speed-arc" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#02d4e6" />
          <stop offset="52%" stopColor="#38a6f8" />
          <stop offset="100%" stopColor="#a18aff" />
        </linearGradient>
        <linearGradient id="aurora-speed-needle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9f7ff" />
          <stop offset="100%" stopColor="#72d7ff" />
        </linearGradient>
      </defs>
      <path className="speedometer-track" d={dialArc(1)} />
      {fraction > 0 && <path className="speedometer-progress" d={dialArc(fraction)} />}
      {SPEED_TICKS.map((tick, index) => {
        const p = dialPoint(index / (SPEED_TICKS.length - 1), 104);
        return <text key={tick} x={p.x} y={p.y} className="speedometer-tick"
          textAnchor="middle" dominantBaseline="central">{tick === 1000 ? '1k' : tick}</text>;
      })}
      <line className="speedometer-needle" x1="160" y1="160" x2={needle.x} y2={needle.y}
        stroke="url(#aurora-speed-needle)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="160" cy="160" r="10" className="speedometer-hub" />
      <circle cx="160" cy="160" r="3" fill="#c5faff" />
    </svg>
    <div className="speedometer-value" aria-live="off">
      <strong>{detailed(rate)}</strong><span>Mbps</span>
    </div>
    <div className="speedometer-stage" role="status" aria-live="polite">
      {active ? <RefreshCw size={15} className="speed-spin" /> : <Wifi size={16} />}
      <span>{label}</span>
    </div>
  </div>;
}

export function ConnectionSpeedTest() {
  const [history, setHistory] = useState<SpeedRow[]>(storedHistory);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [measuredAt, setMeasuredAt] = useState<Date | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [progress, setProgress] = useState<SpeedProgress | null>(null);
  const [error, setError] = useState('');
  const installed = typeof window !== 'undefined' && isTauri();

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(history)); } catch { /* storage unavailable */ }
  }, [history]);

  async function start() {
    if (measuring || !installed) return;
    setMeasuring(true);
    setResult(null);
    setProgress(null);
    setError('');
    let unlisten: UnlistenFn | undefined;
    try {
      // Register BEFORE invoking native code, including the first locating event.
      unlisten = await listen<SpeedProgress>(PROGRESS_EVENT, event => {
        if (event.payload) setProgress(event.payload);
      });
      const value = await invoke<SpeedResult>('measure_connection');
      if ([value.downloadMbps, value.uploadMbps, value.pingMs, value.jitterMs].some(
          n => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) {
        throw new Error('A medição retornou valores inválidos.');
      }
      setResult(value);
      setMeasuredAt(new Date());
      setHistory(old => addHistory(old, value));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      unlisten?.();
      setMeasuring(false);
    }
  }

  const stage = progress?.phase || 'locating';
  const isUpload = stage === 'upload';
  const dialRate = measuring
    ? (isUpload ? progress?.uploadMbps : stage === 'download' ? progress?.downloadMbps : null)
    : result?.downloadMbps;
  const status = !measuring ? (result ? 'Teste concluído' : 'Pronto para medir')
    : stage === 'download' ? 'Medindo download em tempo real'
    : isUpload ? 'Medindo upload em tempo real'
    : stage === 'connecting-upload' ? 'Preparando teste de upload'
    : 'Localizando servidor M-Lab…';
  const download = measuring ? progress?.downloadMbps : result?.downloadMbps;
  const upload = measuring ? progress?.uploadMbps : result?.uploadMbps;
  const ping = measuring ? progress?.pingMs : result?.pingMs;
  const jitter = measuring ? progress?.jitterMs : result?.jitterMs;
  const ip = measuring ? progress?.publicIp : result?.publicIp;

  return <section className="speed-card" aria-label="Teste de conexão">
    <div className="speed-header"><span><Gauge size={20}/><strong>Teste de conexão</strong></span>
      <small>Measurement Lab · NDT7 · servidor automático</small></div>
    <div className="speed-body">
      <Speedometer rate={validRate(dialRate) ? dialRate : null} label={status} active={measuring} />
      <div className="speed-metrics">
        <div className={measuring && stage === 'download' ? 'active' : ''}>
          <ArrowDown size={17}/><span>Download</span><strong>{display(download)} <small>Mbps</small></strong>
        </div>
        <div className={measuring && isUpload ? 'active' : ''}>
          <ArrowUp size={17}/><span>Upload</span><strong>{display(upload)} <small>Mbps</small></strong>
        </div>
        <div><Activity size={17}/><span>Ping TCP (M-Lab)</span><strong>{display(ping)} <small>ms</small></strong></div>
        <div><Gauge size={17}/><span>Jitter TCP (M-Lab)</span><strong>{display(jitter)} <small>ms</small></strong></div>
        <div><Globe size={17}/><span>IP público</span><strong className="speed-ip">{ip || 'Indisponível'}</strong></div>
        <div><Clock3 size={17}/><span>Última medição</span>
          <strong className="speed-time">{measuredAt ? measuredAt.toLocaleString('pt-BR') : '—'}</strong>
        </div>
      </div>
    </div>
    <div className="speed-actions">
      <button className="speed-start" type="button" disabled={measuring || !installed} onClick={() => void start()}>
        <RefreshCw size={17} className={measuring ? 'speed-spin' : ''}/>
        {measuring ? 'Teste em andamento…' : 'Medir agora'}
      </button>
      {result && <span className="speed-quality" role="status">Qualidade: <strong>{quality(result)}</strong></span>}
    </div>
    {!installed && <p className="speed-help">O teste real funciona no aplicativo instalado para Android, Windows e Linux.</p>}
    {error && <p className="speed-error" role="alert">{error}</p>}
    <p className="speed-help speed-privacy">Ao tocar em <strong>Medir agora</strong>, você inicia um teste NDT7 do M-Lab, que coleta e publica IP público, horário e resultados.
      O teste pode consumir centenas de MB em redes rápidas. <a href="https://www.measurementlab.net/privacy/" target="_blank" rel="noreferrer">Privacidade do M-Lab</a>.
      Nenhuma medição ocorre automaticamente.</p>
    <div className="speed-history-title"><strong>Últimas 5 medições</strong>
      <button type="button" onClick={() => setHistory([])} disabled={!history.length || measuring}><Trash2 size={14}/> Limpar histórico</button>
    </div>
    <div className="speed-history" aria-label="Histórico de download, upload e ping">
      <div className="speed-history-row speed-history-columns"><span>Download</span><span>Upload</span><span>Ping</span></div>
      {history.length ? history.map((row, index) =>
        <div key={index} className="speed-history-row">
          <span>{number(row.downloadMbps)} Mbps</span><span>{number(row.uploadMbps)} Mbps</span><span>{number(row.pingMs)} ms</span>
        </div>)
        : <p className="speed-empty">Nenhuma medição registrada.</p>}
    </div>
  </section>;
}
