import { ArrowDownToLine, ArrowRight, CheckCircle2, CloudDownload, DownloadCloud, ExternalLink, Info, LoaderCircle, RefreshCcw, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import type { OnlineUpdater } from './useOnlineUpdater';
import { isAndroidRuntime } from '../platform';

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
    supported, status, currentVersion, available, progress, progressUnavailable, error, check, cancel, install, updateNow,
    includePrereleases, setIncludePrereleases
  } = updater;

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
      <p>{isAndroidRuntime()
        ? 'No Android, as versões de teste ainda usam assinatura temporária. Atualizações do APK exigem uma assinatura persistente e podem precisar da confirmação do próprio Android.'
        : 'A atualização integrada funciona no aplicativo instalado para Windows ou Linux.'}</p></div>}

    {!supported && isAndroidRuntime() && <a className="updates-github-link"
      href="https://github.com/fabriciomatosqa/AURORA-LIVES/releases"
      target="_blank" rel="noopener noreferrer">Abrir APK oficial no GitHub <ExternalLink size={14}/></a>}

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
        <div className="update-progress-meta">
          <span>{progressUnavailable ? 'Baixando e verificando integridade...' : 'Baixando atualização...'}</span>
          <strong>{progressUnavailable ? 'Aguarde' : progress.percent + '%'}</strong>
        </div>
        <div className={'update-progress-track' + (progressUnavailable ? ' is-indeterminate' : '')} role="progressbar" aria-label="Download da atualização"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressUnavailable ? undefined : progress.percent}>
          <span style={{ width: progressUnavailable ? '35%' : progress.percent + '%' }}/>
        </div>
      </>}
      {status === 'downloaded' && <div className="updates-message updates-success">
        <ShieldCheck size={17}/><p>Download concluído. Integridade SHA-256 verificada.</p></div>}
      {connected && (status === 'available' || status === 'downloaded') && <p className="updates-warning">
        Ao atualizar, a sala atual será encerrada e os participantes serão desconectados.
      </p>}
      {status === 'available' && <button className="update-primary-button" onClick={() => void updateNow()}>
        <ArrowDownToLine size={17}/> Atualizar agora
      </button>}
      {status === 'downloading' && <>
        <button className="update-primary-button" disabled>
          <LoaderCircle className="updates-spin" size={17}/> Baixando...
        </button>
        <button className="updates-cancel-button" type="button" onClick={() => void cancel()}>
          <XCircle size={16}/> Cancelar download
        </button>
      </>}
      {status === 'downloaded' && <button className="update-primary-button" onClick={() => void install()}>
        <DownloadCloud size={17}/> Tentar instalação novamente
      </button>}
      {status === 'installing' && <button className="update-primary-button" disabled>
        <LoaderCircle className="updates-spin" size={17}/> Iniciando instalação...
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
      Windows: instalação silenciosa após um clique, sujeita aos bloqueios de segurança do sistema.
      Linux: a instalação é iniciada automaticamente, mas pode exigir senha administrativa.
    </p>
    <a className="updates-github-link" href="https://github.com/fabriciomatosqa/AURORA-LIVES/releases"
      target="_blank" rel="noopener noreferrer" aria-label="Abrir histórico de versões no GitHub">
      Histórico de versões <ExternalLink size={14}/>
    </a>
  </section>;
}
