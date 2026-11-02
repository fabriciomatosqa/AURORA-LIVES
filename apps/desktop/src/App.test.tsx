import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App, { LocalBroadcastPreview, MediaPlayer } from './App';

describe('nova interface AURORA LIVES', () => {
  it('exibe as opções reais de criar e entrar em uma sala por código', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Criar sala agora');
    expect(html).toContain('Entrar na sala');
    expect(html).toContain('id="invite-code"');
    expect(html).toContain('id="lobby-nickname"');
    expect(html).toContain('Informe um nome diferente de Visitante');
    expect(html).toContain('Sem cadastro');
    expect(html).toContain('AURORA LIVES');
    expect(html).toContain('Prévia 0.0.37');
  });

  it('mantém a logo original e as regiões de navegação acessíveis', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('aurora-mark.png');
    expect(html).toContain('Emblema cristalino original da AURORA');
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html).toContain('aria-label="Painel Aurora"');
    expect(html).toContain('aria-label="Espaço e participantes"');
    expect(html).toContain('aria-label="Bem-vindo ao AURORA LIVES"');
  });

  it('mostra controle de tela cheia em todos os vídeos, inclusive para espectadores Android', () => {
    const html = renderToStaticMarkup(<MediaPlayer
      stream={null as unknown as MediaStream} muted={false} label="Transmissão de Branko"/>);
    expect(html).toContain('Exibir em tela cheia: Transmissão de Branko');
    expect(html).toContain('stream-fullscreen-toggle');
    expect(html).toContain('aria-pressed="false"');
    expect(html.toLowerCase()).toContain('playsinline=""');
    expect(html).toContain('data-fullscreen="false"');
    expect(html).toContain('Transmissão de Branko');
  });

  it('permite assistir à própria transmissão no programa, PiP e janela', () => {
    const local = renderToStaticMarkup(<LocalBroadcastPreview stream={null as unknown as MediaStream}/>);
    expect(local).toContain('Minha transmissão');
    expect(local).toContain('Sua transmissão');
    expect(local).toContain('<video');
    expect(local).toContain('Minha transmissão em janela');
    expect(local).toContain('em janela');
    expect(local).toContain('janela flutuante');
    expect(local).not.toContain('Exibir em tela cheia: Sua transmissão');
    const remote = renderToStaticMarkup(<MediaPlayer
      stream={null as unknown as MediaStream} muted={false} label="Transmissão de Celular"/>);
    expect(remote).toContain('Exibir em tela cheia: Transmissão de Celular');
  });

  it('não apresenta funcionalidades futuras como ações disponíveis', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Comunidades públicas em desenvolvimento');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Diagnóstico do dispositivo');
  });
});
