import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Activity, ArrowDown, ArrowUp, Clock3, Gauge, Globe, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { KEY, readHistory, addHistory, quality, number, type SpeedRow, type SpeedResult } from './speedHistory';

function storedHistory(): SpeedRow[] {
  try { return readHistory(localStorage.getItem(KEY)); } catch { return []; }
}

export function ConnectionSpeedTest() {
  const [history, setHistory] = useState<SpeedRow[]>(storedHistory);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [measuredAt, setMeasuredAt] = useState<Date | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState('');
  const installed = typeof window !== 'undefined' && isTauri();

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(history)); } catch { /* storage unavailable */ }
  }, [history]);

  async function start() {
    if (measuring || !installed) return;
    setMeasuring(true);
    setError('');
    try {
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
      setMeasuring(false);
    }
  }

  return <section className="speed-card" aria-label="Teste de conexão">
    <div className="speed-header"><span><Gauge size={20}/><strong>Teste de conexão</strong></span>
      <small>Cloudflare · medição sob demanda</small></div>
    <div className="speed-body">
      <div className={'speed-dial' + (measuring ? ' measuring' : '')} aria-live="polite">
        <div className="speed-dial-inside"><Wifi size={26}/>
          <strong>{measuring ? 'Medindo…' : result ? number(result.downloadMbps) : '—'}</strong>
          <span>{measuring ? 'Conexão em análise' : 'Mbps · download'}</span>
        </div>
      </div>
      <div className="speed-metrics">
        <div><ArrowDown size={17}/><span>Download</span><strong>{result ? number(result.downloadMbps) : '—'} <small>Mbps</small></strong></div>
        <div><ArrowUp size={17}/><span>Upload</span><strong>{result ? number(result.uploadMbps) : '—'} <small>Mbps</small></strong></div>
        <div><Activity size={17}/><span>Ping HTTP</span><strong>{result ? number(result.pingMs) : '—'} <small>ms</small></strong></div>
        <div><Gauge size={17}/><span>Jitter HTTP</span><strong>{result ? number(result.jitterMs) : '—'} <small>ms</small></strong></div>
        <div><Globe size={17}/><span>IP público</span><strong className="speed-ip">{result?.publicIp || 'Indisponível'}</strong></div>
        <div><Clock3 size={17}/><span>Última medição</span><strong className="speed-time">{measuredAt ? measuredAt.toLocaleString('pt-BR') : '—'}</strong></div>
      </div>
    </div>
    <div className="speed-actions">
      <button className="speed-start" type="button" disabled={measuring || !installed} onClick={() => void start()}>
        <RefreshCw size={17} className={measuring ? 'speed-spin' : ''}/>{measuring ? 'Medindo conexão…' : 'Medir agora'}
      </button>
      {result && <span className="speed-quality" role="status">Qualidade: <strong>{quality(result)}</strong></span>}
    </div>
    {!installed && <p className="speed-help">O teste real funciona no aplicativo instalado para Android, Windows e Linux.</p>}
    {error && <p className="speed-error" role="alert">{error}</p>}
    <p className="speed-help">Usa até cerca de 29 MB de dados por teste para medir a conexão até a Cloudflare. Ping/jitter são medições HTTP, não ICMP ou WebRTC. IP consultado via HTTPS. Nenhuma medição ocorre automaticamente.</p>
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
