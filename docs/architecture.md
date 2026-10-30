# Arquitetura de conexão P2P — AURORA LIVES v0.0.2

## Objetivo

Um único executável para todos os participantes, sem cadastro e **sem hospedar servidor pago** durante a prova de conceito.

## Componentes ativos

- **Tauri 2 / React / TypeScript**, igual em Windows e Linux.
- **PeerJS 1.5.5**, biblioteca que encapsula WebRTC.
- **PeerJS Cloud público** em `0.peerjs.com`, somente para sinalização gratuita. Sem garantia de SLA, adequado a testes pequenos.
- **Google STUN público** em `stun.l.google.com:19302` para negociação ICE.
- **DataChannels WebRTC** para mensagens. Anfitrião anuncia identidade à rede e reencaminha mensagens dos convidados aos demais via conexões diretas.
- **MediaConnection WebRTC** de cada participante aos demais para áudio e transmissão de tela. É uma topologia de malha, **não** SFU.

## Fluxo

1. Anfitrião gera código de 16 símbolos do alfabeto de 32 caracteres, usando `crypto.getRandomValues` (80 bits de entropia).
2. ID público de sinalização: `aurora-lives-<codigo>`. Código funciona como convite/segredo; não existe conta.
3. Convidado cria ID aleatório no serviço PeerJS Cloud e conecta diretamente ao ID do anfitrião.
4. Convidado envia `join`. Anfitrião valida e devolve `welcome` com lista de participantes, histórico temporário de até 100 mensagens.
5. Anfitrião retransmite eventos de chat e lista de membros. Mensagens são armazenadas exclusivamente na memória do anfitrião; ninguém tem persistência.
6. Quem ativa microfone ou tela estabelece conexões de mídia separadas, um para cada outro membro da sala.

## Limitações de NAT e operação

O PeerJS Cloud ajuda a descobrir usuários **mas não retransmite mídia**. STUN pode não ser suficiente em NATs simétricos, CGNAT e firewalls. Sem TURN, não há garantia de conexão entre quaisquer duas redes. A malha de mídia multiplica o upload do transmissor por espectador; o limite de 10 membros é uma restrição de UX, não garantia de qualidade 1080p60.

## Segurança

- Mensagens recebidas são validadas e limitadas a 2.000 caracteres.
- A rede só aceita até 9 convidados, além do anfitrião.
- O código privado é o único mecanismo de entrada. Quem souber o código tem acesso; o sistema **não autentica identidades**.
- Tráfego de mídia e dados usa a criptografia transportada por WebRTC, mas não verifica a identidade dos participantes. O sinalizador gratuito pode conhecer os IDs/horários de conexão.
- A API Go antiga ficou apenas no código-fonte e **não é executada pelo desktop**.

## Compatibilidade pendente

WebView2 no Windows e WebKitGTK no Linux têm comportamentos diferentes de `getUserMedia`, `getDisplayMedia`, aceleração de vídeo e reprodução automática. Os builds são testados em CI; o teste real P2P/microfone/tela entre PCs requer máquinas com hardware e permissões reais.

Para larga escala ou distribuição pública, substituir o sinalizador público por serviço próprio e avaliar SFU/TURN conforme capacidade e custos. Não declarar que WebRTC elimina necessidade de infraestrutura em todos os casos.
