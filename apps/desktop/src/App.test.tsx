import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('nova interface AURORA LIVES', () => {
  it('exibe as opções reais de criar e entrar em uma sala por código', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Criar sala agora');
    expect(html).toContain('Entrar na sala');
    expect(html).toContain('id="invite-code"');
    expect(html).toContain('Sem cadastro');
    expect(html).toContain('AURORA LIVES');
    expect(html).toContain('Prévia 0.0.7');
  });

  it('mantém a logo original e as regiões de navegação acessíveis', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('aurora-mark.webp');
    expect(html).toContain('Emblema cristalino original da AURORA');
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html).toContain('aria-label="Painel Aurora"');
    expect(html).toContain('aria-label="Espaço e participantes"');
    expect(html).toContain('aria-label="Bem-vindo ao AURORA LIVES"');
  });

  it('não apresenta funcionalidades futuras como ações disponíveis', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Comunidades públicas em desenvolvimento');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Diagnóstico do dispositivo');
  });
});
