# AURORA LIVES

**Versão de desenvolvimento: 0.0.1**

Aplicativo de comunicação desktop para **Windows e Linux**, inspirado nos fluxos de comunidades e salas de texto/voz do Discord, com identidade própria da marca AURORA.

> **Estado atual:** fundação em implementação. O chat local de desenvolvimento não possui contas, autenticação, persistência ou permissões. **Não exponha o backend à internet.** Voz, vídeo e streaming 1080p60 ainda não estão implementados.

## Arquitetura proposta

- Desktop: Tauri 2 + React + TypeScript.
- Backend: Go.
- Mídia (próximas etapas): WebRTC + LiveKit autogerenciado (SFU).
- Banco de dados (próximas etapas): PostgreSQL.
- Instaladores de prévia: Windows (NSIS .exe) e Linux Ubuntu/Debian (.deb); **um único aplicativo** para transmissores e espectadores no futuro.

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

Abrir http://localhost:1420 para experimentar a interface. Para abrir o aplicativo nativo **com a API local integrada**, use `npm run dev:native` dentro de `apps/desktop` (exige Go e Rust para compilar). Os instaladores gerados já incluem a API local e não exigem Go ou Node no computador de destino.

**Atenção:** a prévia instalada funciona como chat local de demonstração. A instalação é igual para todos, mas ainda **não conecta pessoas em computadores diferentes**: isso exigirá a infraestrutura comum de autenticação, sinalização e SFU planejada. Ninguém precisará instalar um aplicativo separado de servidor para compartilhar ou assistir no produto final.

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
5. Assinatura dos instaladores e atualização integrada (os pacotes desta prévia ainda **não são assinados**).

Consulte [docs/architecture.md](docs/architecture.md) para decisões técnicas e limitações.
