import { ArrowDownToLine, Clock3, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { OnlineUpdater } from './useOnlineUpdater';

/**
 * Non-blocking update prompt, inspired by AURORA AutoFill.
 * One click on Sim starts the verified download and installer, without another app confirmation.
 */
export function UpdatePrompt({ updater, connected }: {
  updater: OnlineUpdater;
  connected: boolean;
}) {
  if (!updater.notificationVisible || !updater.available) return null;

  function accept() {
    void updater.updateNow();
  }

  return <section className="update-prompt" role="region" aria-label="Nova versão do AURORA LIVES disponível">
    <div className="update-prompt-top">
      <span><Sparkles size={15}/> ATUALIZAÇÃO DISPONÍVEL</span>
      <button type="button" onClick={updater.snooze}
        title="Lembrar novamente em 2 horas" aria-label="Adiar atualização"><X size={17}/></button>
    </div>
    <strong>AURORA LIVES v{updater.available.version}</strong>
    <p>Você está usando a versão v{updater.currentVersion}. Um clique baixa, verifica e inicia a instalação.
      {connected && ' A sala atual será encerrada.'}
      {updater.available.previewApk && ' Este APK de teste pode ter assinatura diferente e exigir reinstalação.'}</p>
    <div className="update-prompt-actions">
      <button className="update-prompt-later" type="button" onClick={updater.snooze}>
        <Clock3 size={15}/> Não, depois
      </button>
      <button className="update-prompt-now" type="button" onClick={accept}>
        <ArrowDownToLine size={15}/> Sim, atualizar
      </button>
    </div>
    <small><ShieldCheck size={13}/> Download com verificação SHA-256. Sem conta GitHub ou Microsoft Store.</small>
  </section>;
}
