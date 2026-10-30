# AURORA LIVES

**Versão de desenvolvimento: 0.0.1**

Aplicativo de comunicação desktop para **Windows e Linux**, inspirado nos fluxos de comunidades e salas de texto/voz do Discord, com identidade própria da marca AURORA.

> **Estado atual:** fundação em implementação. O chat local de desenvolvimento não possui contas, autenticação, persistência ou permissões. **Não exponha o backend à internet.** Voz, vídeo e streaming 1080p60 ainda não estão implementados.

## Arquitetura proposta

- Desktop: Tauri 2 + React + TypeScript.
- Backend: Go.
- Mídia (próximas etapas): WebRTC + LiveKit autogerenciado (SFU).
- Banco de dados (próximas etapas): PostgreSQL.
- Distribuição futura: Windows e Linux.

## Iniciar o ambiente de desenvolvimento

Necessário: Go 1.23+, Node.js 22+ e npm. Para abrir a janela nativa, instalar também [pré-requisitos do Tauri 2](https://v2.tauri.app/start/prerequisites/).

Terminal 1:

```bash
cd services/api
go run ./cmd/aurora-api
```

Terminal 2:

```bash
cd apps/desktop
npm install
npm run dev
```

Abrir http://localhost:1420 para experimentar a interface. O app desktop nativo pode ser iniciado com `npm run tauri dev`.

O serviço de desenvolvimento escuta por padrão **127.0.0.1:8787**. O chat funciona apenas no mesmo computador; dados são mantidos em memória e perdidos ao reiniciar. Ainda não é seguro nem apropriado para hospedar publicamente. O nome de usuário é apenas um apelido local, não identidade verificada.

## Testes

```bash
cd services/api && go test ./...
cd ../../apps/desktop && npm install && npm run build
```

## Marca

A identidade oficial é o **emblema cristalino triangular AURORA**. Não redesenhar nem substituir. O repositório deve conter um derivado reduzido para a interface e, quando houver mecanismo de transferência binária disponível, a imagem original em alta resolução.

## Próximos marcos

1. Auth real e PostgreSQL com migrações.
2. Spaces/canais/convites com permissões.
3. VoIP via LiveKit (microfone, dispositivos).
4. Compartilhamento de tela, áudio do sistema, vídeo e otimização para 1080p60.
5. Instaladores assinados e atualização integrada.

Consulte [docs/architecture.md](docs/architecture.md) para decisões técnicas e limitações.
