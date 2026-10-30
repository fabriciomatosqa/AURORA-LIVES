import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpdateSettings } from './UpdateSettings';
import type { OnlineUpdater } from './useOnlineUpdater';

const base = {
  supported: true,
  status: 'available',
  currentVersion: '0.0.5',
  available: { tag: 'v0.0.6-preview', version: '0.0.6', notes: 'Novos recursos', publishedAt: null, sizeBytes: 2500000 },
  progress: { downloadedBytes: 0, totalBytes: 2500000, percent: 0 },
  error: '',
  check: async () => {},
  download: async () => {},
  install: async () => {},
} satisfies OnlineUpdater;

describe('atualização pelo próprio programa', () => {
  it('exibe versão disponível e opção real de baixar', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={base} connected={false}/>);
    expect(html).toContain('0.0.6');
    expect(html).toContain('Baixar atualização');
    expect(html).toContain('Novos recursos');
  });
  it('exibe progresso do download', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, status: 'downloading', progress: { downloadedBytes: 1250000, totalBytes: 2500000, percent: 50 }}} connected={false}/>);
    expect(html).toContain('50%');
    expect(html).toContain('progressbar');
  });
  it('não promete instalação automática onde o runtime nativo não existe', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, supported: false, status: 'unsupported' }} connected={false}/>);
    expect(html).toContain('aplicativo instalado');
    expect(html).not.toContain('Baixar atualização');
  });
  it('avisa que instalação pode interromper comunicação', () => {
    const html = renderToStaticMarkup(<UpdateSettings updater={{ ...base, status: 'downloaded' }} connected/>);
    expect(html).toContain('encerrar a sala');
    expect(html).toContain('Instalar atualização');
  });
});
