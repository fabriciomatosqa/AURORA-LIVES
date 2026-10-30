# AURORA LIVES

**Versão de desenvolvimento 0.0.2 — salas P2P sem mensalidade**

AURORA LIVES é um aplicativo para Windows e Linux com a identidade cristalina da marca AURORA. **Todos usam o mesmo instalador:** qualquer participante pode criar uma sala, entrar por convite, conversar, ativar o microfone ou compartilhar sua tela.

## Como conectar dois computadores pela internet

1. Instale o mesmo AURORA LIVES em cada computador.
2. No primeiro, clique em **Criar sala** e copie o código privado de 16 caracteres.
3. Envie o código ao outro participante por um canal de sua preferência.
4. No segundo computador, abra **Entrar em uma sala**, informe o código e clique em **Entrar na sala**.
5. A conexão ocorre por **WebRTC**, sem cadastro. Mensagens trafegam por um canal de dados P2P. Ambos podem tentar compartilhar microfone e tela.

Até **10 pessoas**, contando o anfitrião. **O anfitrião precisa permanecer conectado.** Não há histórico permanente nem moderação/autenticação; **qualquer pessoa com o código pode entrar**.

## Infraestrutura e limitações importantes

**Sem servidor pago não significa ausência absoluta de infraestrutura.**

- O projeto utiliza o serviço público **PeerJS Cloud** (gratuito) para **sinalização**: os participantes se encontram e trocam os parâmetros para estabelecer a conexão. Não armazena mensagens ou mídia.
- Um servidor **STUN público** ajuda a atravessar roteadores e NAT. Não há servidor TURN configurado.
- **A comunicação ocorre diretamente entre computadores** quando a rede permite. Redes com CGNAT/NAT simétrico ou firewalls rigorosos podem impedir a conexão; nesses casos será necessário um retransmissor TURN (que gera custo) ou mudar de rede.
- As mensagens dos convidados passam pelo computador do anfitrião, que as retransmite aos demais por canais WebRTC.
- Áudio e compartilhamento de tela são **experimentais**, feitos diretamente em malha (um stream enviado a cada espectador). Em grupos de 5–10 pessoas isso pode exigir muito upload. **1080p60 é uma meta, não qualidade verificada**.
- A captura de tela e áudio depende do WebView do sistema: **Windows usa WebView2; Linux usa WebKitGTK**. A compatibilidade real dessas capturas ainda precisa de testes em máquinas físicas.
- Não existe identificação persistente de usuário, criptografia ponta a ponta com verificação de identidade, bloqueio de convidados ou transferência de arquivos.
- Os instaladores de prévia não estão assinados.

O backend Go anterior permanece em `services/api/` para referência e testes legados, mas **não integra o instalador e não é necessário para o P2P**.

## Testes e desenvolvimento

Requisitos: Node.js 22+, npm e pré-requisitos do [Tauri 2](https://v2.tauri.app/start/prerequisites/).

```bash
cd apps/desktop
npm install
npm run test
npm run build
npm run dev
# janela nativa
npm run dev:native
# gerar instalador local
npm run package:desktop
```

Os workflows do GitHub compilam frontend e desktop para Windows e Linux. A compilação não substitui o teste real de conexões P2P entre diferentes redes.

## Segurança

O convite é um segredo temporário gerado aleatoriamente. **Não o publique.** Fechar a janela do anfitrião encerra a sala e as mensagens não são guardadas. O serviço gratuito de sinalização é mantido por terceiros e pode ficar indisponível ou limitar tráfego; não deve ser assumido como infraestrutura garantida para o público em geral.

Consulte [docs/architecture.md](docs/architecture.md) para arquitetura e limitações, e as Issues do GitHub para evolução.
