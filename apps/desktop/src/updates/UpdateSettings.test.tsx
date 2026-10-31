import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpdateSettings } from './UpdateSettings';
import { UpdatePrompt } from './UpdatePrompt';
import type { OnlineUpdater } from './useOnlineUpdater';

const base = {
  supported: true,
  status: 'available',
  currentVersion: '0.0.8',
  available: { tag: 'v0.0.9-preview', version: '0.0.9', notes: 'Novos recursos', publishedAt: null, sizeBytes: 2500000 },
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
    expect(html).toContain('0.0.9');
    expect(html).toContain('Atualizar agora');
    expect(html).toContain('Receber versões de teste');
    expect(html).toContain('Novos recursos');
  });

  it('mostra notificação Sim/Não sem executar nada durante renderização', () => {
    const html = renderToStaticMarkup(<UpdatePrompt updater={base} connected={false}/>);
    expect(html).toContain('Sim, atualizar');
    expect(html).toContain('Não, depois');
    expect(html).toContain('GitHub');
    expect(html).toContain('0.0.9');
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

  it('não permite atualizar no preview de navegador', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, supported: false, status: 'unsupported' }} connected={false}/>);
    expect(html).toContain('aplicativo instalado');
    expect(html).not.toContain('Baixar atualização');
  });

  it('avisa que atualizar encerra uma sala conectada sem exigir novo diálogo', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, status: 'downloaded' }} connected/>);
    expect(html).toContain('sala atual será encerrada');
    expect(html).toContain('Tentar instalação novamente');
  });
});
