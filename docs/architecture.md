# Arquitetura inicial (v0.0.1)

O projeto começa com uma **prévia local restrita** em vez de simular funcionalidades que ainda não existem.

- **Camada de interface:** React/TypeScript com Vite, hospedada futuramente em shell Tauri 2.
- **API:** Go HTTP, com endpoints para salas e mensagens; eventos ao vivo por Server-Sent Events (SSE). SSE é adequado para a prévia de chat, e não será usado para transportar áudio ou vídeo.
- **Armazenamento:** exclusivamente em memória nesta primeira entrega; máximo 100 mensagens por sala. Não constitui histórico persistente.
- **Identificação:** apelido local, sem autenticação; nenhum controle de acesso a salas. Portanto, backend bind em localhost.
- **Mídia:** a arquitetura futura é WebRTC+LiveKit SFU autogerenciado e TURN quando necessário; atualmente não implementada.
- **Custo:** infraestrutura local enquanto os protocolos, autenticação e compatibilidade não são validados.

## Decisões pendentes

1. Testar captura de janela/tela e codificação de hardware pelo Tauri/WebKitGTK no Linux (X11 e Wayland) e WebView2 no Windows, antes de prometer 1080p60.
2. Validar captura de áudio do sistema nas duas plataformas com APIs nativas.
3. Integrar PostgreSQL, autenticação e autorização **antes de qualquer exposição de rede pública**.
4. Implementar tokens de acesso LiveKit emitidos apenas após autorização.
5. Configurar TLS, TURN, firewall e limites de custo de tráfego antes da publicação.
6. Implementar atualizações assinadas, após a definição dos pacotes de distribuição.

## Contrato da API local

- `GET /api/health` — saúde e versão.
- `GET /api/rooms` — salas.
- `POST /api/rooms` — criar sala de texto.
- `GET /api/rooms/:id/messages` — últimas 100 mensagens.
- `POST /api/rooms/:id/messages` — publicar mensagem (autor e texto).
- `GET /api/rooms/:id/events` — SSE, evento `message`.

Os eventos não têm replay: o cliente consulta o histórico ao conectar. Este contrato será substituído/adaptado ao backend autenticado no marco seguinte.
