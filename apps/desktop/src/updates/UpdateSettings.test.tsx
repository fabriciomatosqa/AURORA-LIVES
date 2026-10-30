import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpdateSettings } from './UpdateSettings';
import { UpdatePrompt } from './UpdatePrompt';
import type { OnlineUpdater } from './useOnlineUpdater';

const base = {
  supported: true,
  status: 'available',
  currentVersion: '0.0.6',
  available: { tag: 'v0.0.7-preview', version: '0.0.7', notes: 'Novos recursos', publishedAt: null, sizeBytes: 2500000 },
  progress: { downloadedBytes: 0, totalBytes: 2500000, percent: 0 },
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
  it('exibe nova versão, botão de download e preferência de previews', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={base} connected={false}/>);
    expect(html).toContain('0.0.7');
    expect(html).toContain('Baixar atualização');
    expect(html).toContain('Receber versões de teste');
    expect(html).toContain('Novos recursos');
  });

  it('mostra notificação Sim/Não sem executar nada durante renderização', () => {
    const html = renderToStaticMarkup(<UpdatePrompt updater={base} connected={false}/>);
    expect(html).toContain('Sim, atualizar');
    expect(html).toContain('Não, depois');
    expect(html).toContain('GitHub');
    expect(html).toContain('0.0.7');
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

  it('não permite atualizar no preview de navegador', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, supported: false, status: 'unsupported' }} connected={false}/>);
    expect(html).toContain('aplicativo instalado');
    expect(html).not.toContain('Baixar atualização');
  });

  it('avisa que a instalação encerra uma sala conectada', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, status: 'downloaded' }} connected/>);
    expect(html).toContain('encerrar a sala');
    expect(html).toContain('Instalar atualização');
  });
});
