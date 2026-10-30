# AURORA LIVES — Sistema visual Aurora 0.0.4

O frontend foi refeito para funcionar como um aplicativo de comunicação desktop de verdade, mantendo a lógica da sessão P2P e a marca cristalina AURORA original.

## Decisões de interface

- **A marca é a âncora visual**: cristal Aurora em posições-chave, sem substituição por logotipo genérico. Ornamentos (órbitas, brilho e grades) são CSS e usam iluminação discreta.
- **Layout hierárquico**: barra de atalhos, espaço/canais, área principal e painel de informações. Em janelas menores, canais viram painel lateral acionado pelo menu; informações aparecem sob demanda.
- **Início**: hero com mensagem clara e dois caminhos reais, Criar sala e Entrar na sala. Nenhum controle simula funções inexistentes.
- **Sala**: convite sempre visível, palco separado da conversa e controles de microfone, tela e recepção de áudio diretamente ao lado da transmissão.
- **Diagnóstico**: estatísticas disponíveis, sem inventar qualidade da rede, com dados adicionais num painel expansível.
- **Acessibilidade**: elementos semânticos de navegação, estados aria-pressed, rótulos de formulário, foco visível e animações reduzidas quando solicitadas pelo sistema.
- **Temas reais**: escuro, claro e automático baseado na preferência do sistema. Nenhuma inversão total de imagem ou cores.
- **Performance**: sem bibliotecas adicionais de efeitos, sem imagens remotas e sem animações contínuas de fundo. A nova apresentação está em CSS puro.

## Tokens CSS

Arquivo apps/desktop/src/styles.css: superfícies, painéis, tipografia e bordas. apps/desktop/src/p2p.css: lobby, sala, palco e chat. Cores reagem ao atributo data-theme em document.documentElement.

## Testes

npm run test verifica o protocolo P2P e a estrutura renderizada da tela inicial, além de compatibilidade, convites e reconexão. npm run build valida TypeScript e gera o frontend.

CI compila o aplicativo nativo para Windows e Linux; a experiência audiovisual ainda depende de testes reais. Nenhuma mudança visual adiciona servidor, contas ou custo de infraestrutura.

## Plataforma

WebView2 no Windows e WebKitGTK no Linux podem tratar mídia de modo diferente. Compartilhamento e áudio ainda são experimentais.
