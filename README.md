# AURORA LIVES

**Versão 0.0.6 (prévia) — Atualizações GitHub no padrão AURORA AutoFill**

Aplicativo desktop de comunicação para Windows e Linux com a logo cristalina AURORA. **Um único instalador para todos:** qualquer pessoa pode criar uma sala, convidar outras pessoas, conversar e tentar compartilhar voz/tela, sem contas nem servidor pago.

## Comece em 3 passos

1. Todos instalam AURORA LIVES a partir das [versões de teste](https://github.com/fabriciomatosqa/AURORA-LIVES/releases).
2. Uma pessoa clica em **Criar sala** e depois **Convite WhatsApp**. O texto copiado contém o código privado.
3. Cada convidado clica em **Entrar em uma sala**, insere o código e confirma. O anfitrião precisa permanecer conectado.

**Máximo: 10 participantes.** Não existe login nem histórico permanente.

## Novidades 0.0.3

- **Smart Connect:** até 3 tentativas de reconexão do convidado após falha temporária; encerra com erro compreensível se não conseguir.
- **Convites:** copiar código ou mensagem pronta para WhatsApp. O código tem 16 caracteres.
- **Convites locais opcionais:** botão **Salvar** guarda o código apenas neste computador, com limite de 5 códigos e limpeza após 30 dias. Qualquer pessoa que tenha acesso ao perfil local poderá ler os códigos salvos.
- **Diagnóstico:** verifica a presença das APIs WebRTC, microfone, captura de tela e Picture-in-Picture. Não garante permissões.
- **Estatísticas:** RTT e estimativa de banda exibidos somente quando fornecidos pelo RTCPeerConnection. Não equivalem a teste de velocidade.
- **Perfis de vídeo:** modo automático solicita 1080p60 para 1–2 pessoas, 1080p30 para 3, 720p30 para 4–6, 480p30 para 7–10. Perfis manuais disponíveis. O FPS real pode ser menor.
- **Áudio:** opção de silenciar o recebimento dos microfones dos participantes.
- **Picture-in-Picture:** janela flutuante de transmissão apenas quando suportada pelo webview do sistema.

## Limitações importantes

A arquitetura usa o **PeerJS Cloud gratuito para sinalização** e STUN público para negociar conexões WebRTC. **Não existe TURN nem SFU nesta etapa.** CGNAT, NAT simétrico e firewalls podem impedir a conexão. Não há garantia de funcionar em todas as redes sem um retransmissor.

Em P2P malha, o transmissor envia um fluxo para cada espectador. Com grupos grandes, o upload pode ser elevado; a qualidade automática é apenas uma sugestão de captura, não adaptação individual por espectador.

**Os testes CI e simulações automatizadas não comprovam o funcionamento real entre duas redes nem a captura de áudio/tela em Windows e Linux.** Esses recursos permanecem experimentais e devem ser validados em computadores físicos. WebView2 e WebKitGTK podem se comportar de forma diferente.

Os convites são secretos temporários: quem souber o código pode entrar. Não compartilhe publicamente. A identidade não é autenticada. O transporte WebRTC é criptografado, mas não verifica a identidade do usuário. Instaladores não assinados.

## AURORA LIVES 0.0.6 — Atualizar pelo GitHub sem Microsoft Store

A partir da 0.0.6, o funcionamento da atualização segue o padrão do AURORA AutoFill: verifica as releases ao iniciar e periodicamente, avisa **"Sim, atualizar / Não, depois"**, lembra após três horas se você adiar, permite selecionar prévias, exibe o progresso e oferece cancelamento do download. Um clique em **Sim** baixa o instalador oficial, verifica a integridade e inicia a instalação. O usuário confirma novamente caso esteja em uma sala.

O Windows usa **Inno Setup por usuário** (sem exigir conta Microsoft ou direitos de administrador); o Ubuntu/Debian abre o gerenciador de pacotes. Nenhuma versão é instalada sem consentimento. Essa mudança não cria servidores pagos nem altera as salas P2P.

**Importante:** o instalador Windows continua sem assinatura digital confiável. O AutoFill também usa instaladores sem assinatura, e reproduzir seu fluxo **não garante** superar bloqueios do Smart App Control. Não desative a proteção do Windows.

**Migração:** se já existir instalação anterior do AURORA LIVES pelo instalador NSIS (0.0.4/0.0.5), ela pode aparecer separadamente no Windows. Caso aconteça, feche o aplicativo e desinstale a versão antiga pelo Windows, preservando a nova instalação Inno Setup.

## Atualização online pelo GitHub

O aplicativo verifica ao iniciar e a cada seis horas se existe release mais recente no GitHub. Em **Configurações → Atualizações online**, você pode procurar, baixar com progresso e abrir o instalador diretamente, sem encontrar a versão no navegador. O download é verificado com SHA-256 e o usuário confirma a instalação. No Linux, o gerenciador de pacotes pode solicitar senha.

**Primeira instalação do novo canal:** instale a versão **0.0.6** uma vez pela [página de releases](https://github.com/fabriciomatosqa/AURORA-LIVES/releases). A 0.0.4 não possui atualização integrada; a 0.0.5 encontra novas versões pelo GitHub, mas ainda abre o instalador interativo. A partir da 0.0.6, o fluxo de atualização segue o padrão do AutoFill.

Leia [docs/online-updates.md](docs/online-updates.md) para detalhes e limitações.
## Desenvolvimento

```bash
cd apps/desktop
npm install
npm run test
npm run build
npm run dev:native
# Linux: gerar instalador .deb
npm run package:desktop -- --bundles deb
# Windows: CI usa Tauri --no-bundle e Inno Setup 6
# Consulte apps/desktop/packaging/windows/AURORA-LIVES.iss
```

Consulte [docs/architecture.md](docs/architecture.md) e as Issues do projeto.
