import { ArrowDownToLine, Clock3, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { OnlineUpdater } from './useOnlineUpdater';

/**
 * Non-blocking update prompt, inspired by AURORA AutoFill.
 * No installer or download is started until the user explicitly says Sim.
 */
export function UpdatePrompt({ updater, connected }: {
  updater: OnlineUpdater;
  connected: boolean;
}) {
  if (!updater.notificationVisible || !updater.available) return null;

  function accept() {
    if (connected && !window.confirm(
      'Uma atualização pode encerrar sua sala e desconectar seus amigos. Deseja instalar agora?'
    )) return;
    void updater.updateNow();
  }

  return <section className="update-prompt" role="region" aria-label="Nova versão do AURORA LIVES disponível">
    <div className="update-prompt-top">
      <span><Sparkles size={15}/> ATUALIZAÇÃO DISPONÍVEL</span>
      <button type="button" onClick={updater.snooze}
        title="Lembrar novamente em 3 horas" aria-label="Adiar atualização"><X size={17}/></button>
    </div>
    <strong>AURORA LIVES v{updater.available.version}</strong>
    <p>Você está usando a versão v{updater.currentVersion}. Deseja baixar e instalar a atualização pelo GitHub?</p>
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
