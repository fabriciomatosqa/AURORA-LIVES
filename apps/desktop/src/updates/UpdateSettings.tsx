import { ArrowDownToLine, ArrowRight, CheckCircle2, CloudDownload, DownloadCloud, ExternalLink, Info, LoaderCircle, RefreshCcw, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import type { OnlineUpdater } from './useOnlineUpdater';

function formatSize(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
}

export function UpdateIndicator({ updater, onClick }: { updater: OnlineUpdater; onClick: () => void }) {
  if (!updater.available || !['available', 'downloaded', 'downloading', 'error'].includes(updater.status)) return null;
  return <button className="update-indicator" type="button" onClick={onClick}
    title={'AURORA LIVES ' + updater.available.version + ' disponível'}>
    <span className="update-indicator-dot"/>
    <span>{updater.status === 'downloaded' ? 'Atualização pronta' : 'Nova versão ' + updater.available.version}</span>
    <ArrowRight size={15}/>
  </button>;
}

export function UpdateSettings({ updater, connected }: { updater: OnlineUpdater; connected: boolean }) {
  const {
    supported, status, currentVersion, available, progress, error, check, download, cancel, install,
    includePrereleases, setIncludePrereleases
  } = updater;

  function launchInstaller() {
    if (connected && !window.confirm(
      'A instalação pode encerrar o AURORA LIVES e sua sala atual. Deseja continuar?'
    )) return;
    void install();
  }

  return <section className="updates-section" aria-label="Atualizações do AURORA LIVES">
    <div className="updates-heading">
      <span className="updates-symbol"><CloudDownload size={22}/></span>
      <div><strong>Atualizações online</strong><small>Diretamente do GitHub Releases oficial</small></div>
    </div>
    <div className="updates-version">
      <span>Versão instalada</span>
      <strong>v{currentVersion}</strong>
    </div>
    <label className="updates-channel-toggle">
      <input type="checkbox" checked={includePrereleases}
        onChange={event => setIncludePrereleases(event.target.checked)} />
      <span><strong>Receber versões de teste</strong><small>Inclui versões publicadas como Pre-release no GitHub.</small></span>
    </label>
    {!supported && <div className="updates-message"><Info size={17}/>
      <p>A atualização integrada funciona no aplicativo instalado para Windows ou Linux.</p></div>}

    {supported && status === 'checking' && <div className="updates-message">
      <LoaderCircle className="updates-spin" size={17}/><p>Procurando novas versões no GitHub...</p>
    </div>}
    {supported && status === 'up-to-date' && <div className="updates-message updates-success">
      <CheckCircle2 size={17}/><p>Você já está usando a versão mais recente disponível.</p>
    </div>}
    {supported && available && <div className="available-release">
      <div className="available-release-top">
        <span className="release-spark"><Sparkles size={16}/> NOVA VERSÃO</span>
        <strong>v{available.version}</strong>
      </div>
      <span className="release-size">Instalador: {formatSize(available.sizeBytes)}</span>
      {available.notes && <p className="release-notes">{available.notes}</p>}
      {status === 'downloading' && <>
        <div className="update-progress-meta"><span>Baixando atualização...</span><strong>{progress.percent}%</strong></div>
        <div className="update-progress-track" role="progressbar" aria-label="Download da atualização"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <span style={{ width: progress.percent + '%' }}/>
        </div>
      </>}
      {status === 'downloaded' && <div className="updates-message updates-success">
        <ShieldCheck size={17}/><p>Download concluído. Integridade SHA-256 verificada.</p></div>}
      {connected && status === 'downloaded' && <p className="updates-warning">
        A instalação pode encerrar a sala atual. Avise os participantes antes de continuar.
      </p>}
      {status === 'available' && <button className="update-primary-button" onClick={() => void download()}>
        <ArrowDownToLine size={17}/> Baixar atualização
      </button>}
      {status === 'downloading' && <>
        <button className="update-primary-button" disabled>
          <LoaderCircle className="updates-spin" size={17}/> Baixando...
        </button>
        <button className="updates-cancel-button" type="button" onClick={() => void cancel()}>
          <XCircle size={16}/> Cancelar download
        </button>
      </>}
      {status === 'downloaded' && <button className="update-primary-button" onClick={launchInstaller}>
        <DownloadCloud size={17}/> Instalar atualização
      </button>}
      {status === 'installing' && <button className="update-primary-button" disabled>
        <LoaderCircle className="updates-spin" size={17}/> Abrindo instalador...
      </button>}
    </div>}
    {supported && error && <div className="updates-error" role="alert"><Info size={16}/><p>{error}</p></div>}
    {supported && <button type="button" className="updates-check-button"
      disabled={status === 'checking' || status === 'downloading' || status === 'installing'}
      onClick={() => void check(true)}>
      <RefreshCcw size={15}/> Verificar atualizações
    </button>}
    <p className="updates-footnote">
      <ShieldCheck size={14}/> Atualizações obtidas diretamente do GitHub e conferidas com SHA-256.
      O Windows ainda poderá bloquear instaladores sem assinatura, e o Linux pode solicitar autorização.
    </p>
    <a className="updates-github-link" href="https://github.com/fabriciomatosqa/AURORA-LIVES/releases"
      target="_blank" rel="noopener noreferrer" aria-label="Abrir histórico de versões no GitHub">
      Histórico de versões <ExternalLink size={14}/>
    </a>
  </section>;
}
