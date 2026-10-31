import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpdateSettings } from './UpdateSettings';
import { UpdatePrompt } from './UpdatePrompt';
import type { OnlineUpdater } from './useOnlineUpdater';

const base = {
  supported: true,
  status: 'available',
  currentVersion: '0.0.19',
  available: { tag: 'v0.0.20-preview', version: '0.0.20', notes: 'Novos recursos', publishedAt: null, sizeBytes: 2500000, previewApk: false },
  progress: { downloadedBytes: 0, totalBytes: 2500000, percent: 0 },
  progressUnavailable: false,
  error: '',
  includePrereleases: true,
  setIncludePrereleases: (_enabled: boolean) => {},
  notificationVisible: true,
  snooze: () => {},
  check: async () => {},
  download: async () => true,
  cancel: async () => {},
  install: async () => true,
  updateNow: async () => {},
} satisfies OnlineUpdater;

describe('atualizações GitHub no estilo AURORA AutoFill', () => {
  it('exibe nova versão, atualização em um clique e preferência de previews', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={base} connected={false}/>);
    expect(html).toContain('0.0.20');
    expect(html).toContain('Atualizar agora');
    expect(html).toContain('Receber versões de teste');
    expect(html).toContain('Novos recursos');
  });

  it('avisa quando uma atualização é um APK de teste', () => {
    const html = renderToStaticMarkup(<UpdatePrompt updater={{ ...base,
      available: { ...base.available, previewApk: true } }} connected={false}/>);
    expect(html).toContain('assinatura diferente');
  });

  it('mostra notificação Sim/Não sem executar nada durante renderização', () => {
    const html = renderToStaticMarkup(<UpdatePrompt updater={base} connected={false}/>);
    expect(html).toContain('Sim, atualizar');
    expect(html).toContain('Não, depois');
    expect(html).toContain('GitHub');
    expect(html).toContain('0.0.20');
  });

  it('não mostra notificação quando o lembrete foi adiado', () => {
    const html = renderToStaticMarkup(<UpdatePrompt updater={{ ...base, notificationVisible: false }} connected={false}/>);
    expect(html).toBe('');
  });

  it('mostra progresso e opção de cancelar o download', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, status: 'downloading', progress: { downloadedBytes: 1250000, totalBytes: 2500000, percent: 50 } }} connected={false}/>);
    expect(html).toContain('50%');
    expect(html).toContain('progressbar');
    expect(html).toContain('Cancelar download');
  });

  it('continua o download quando o evento de progresso não está autorizado', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, status: 'downloading', progressUnavailable: true }} connected={false}/>);
    expect(html).toContain('Baixando e verificando integridade...');
    expect(html).not.toContain('aria-valuenow="0"');
  });

  it('não diz que o APK está atualizado quando o lançamento Android ainda não foi publicado', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, status: 'android-pending', available: null }} connected={false}/>);
    expect(html).toContain('APK Android assinado e compatível');
    expect(html).not.toContain('versão mais recente disponível');
    expect(html).not.toContain('Atualizar agora');
  });

  it('não permite atualizar no preview de navegador', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, supported: false, status: 'unsupported' }} connected={false}/>);
    expect(html).toContain('aplicativo nativo instalado');
    expect(html).not.toContain('Baixar atualização');
  });

  it('informa sobre instalação Android e preserva o aviso de sala conectada', () => {
    const androidView = renderToStaticMarkup(<UpdateSettings updater={base} connected={false}/>);
    expect(androidView).toContain('Atualizar agora');
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, status: 'downloaded' }} connected/>);
    expect(html).toContain('sala atual será encerrada');
    expect(html).toContain('Tentar instalação novamente');
  });
});
