# AURORA LIVES Android — primeira prévia 0.0.7

O AURORA LIVES continua em um único repositório. O Android é compilado a partir do mesmo projeto Tauri 2 + React/PeerJS do Windows e Ubuntu, sem criar um protocolo incompatível.

## Funcionalidades implementadas

- Visual original AURORA para **retrato e paisagem**, temas claro/escuro, margens do sistema e botões adaptados ao toque.
- Salas privadas com o mesmo código de 16 caracteres, até 10 pessoas, anfitrião e convidados, chat temporário e reconexão. O protocolo P2P é o mesmo desktop.
- Compartilhamento do convite pelo menu nativo do Android, quando disponível.
- Abas **Transmissão / Chat / Pessoas / Ajustes**. Em paisagem, transmissão e conversa aparecem lado a lado; em retrato, cada uma ocupa a tela.
- Lista de participantes e anfitrião, reprodução de áudio recebido, controle de silenciar e microfone usando WebRTC MediaDevices.
- Permissões de Internet e microfone, sem orientação de tela travada, tecla Voltar tratada sem descartar uma sala acidentalmente.
- APK ARM64 experimental construído em GitHub Actions, gerado pelo mesmo código do projeto.

## Limites honestos da prévia

- **Compartilhar a tela do próprio Android ainda não está implementado.** Android WebView não oferece a mesma API getDisplayMedia do Windows. Uma versão futura precisa MediaProjection nativo e consentimento do sistema. O botão mostra a indisponibilidade.
- Receber a tela do desktop e falar por microfone têm código PeerJS/WebRTC compartilhado, mas precisam ser validados em aparelhos físicos. Compilar o APK não prova o funcionamento da voz em todo Android/WebView.
- **Não há servidor dedicado, TURN ou SFU.** O PeerJS Cloud gratuito oferece sinalização, e algumas redes podem bloquear conexões P2P.
- Sem conexão garantida com o celular bloqueado: Android pode pausar o WebView. O serviço de primeiro plano e notificação serão melhorias futuras.
- **O APK debug é só para testes:** utiliza certificado temporário do GitHub runner. A versão seguinte pode exigir desinstalar a antiga e perder preferências. Não é um APK oficial de produção, nem permite atualização silenciosa.
- A atualização Android ainda não ocorre dentro do app: Configurações aponta para releases GitHub, mas o sistema precisa autorizar a instalação de APK.

## Compilar

Pré-requisitos: Node 22, Rust, Java 17+, Android SDK, NDK 27 e platform tools. Consulte https://v2.tauri.app/start/prerequisites/

Na pasta apps/desktop:

```bash
npm install
npm run icons
rustup target add aarch64-linux-android
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
npm run tauri -- android init --ci
python3 scripts/patch-android-manifest.py
npm run tauri -- android build --apk --debug --target aarch64 --ci
```

O APK fica sob src-tauri/gen/android/app/build/outputs/apk/. Não distribua o APK de depuração como versão estável.

O frontend está em src/App.tsx, src/p2p, src/android.css e src/platform.ts. O Android utiliza a biblioteca Rust src-tauri/src/lib.rs; o desktop permanece inalterado quanto ao funcionamento P2P.

## Distribuição

O workflow .github/workflows/android.yml compila um APK de teste ARM64 em PR e main e o disponibiliza como artefato GitHub Actions. Para um APK atualizável e com assinatura constante, é necessária uma chave de assinatura Android armazenada em secrets e teste de instalação real.

## Permissões de microfone

O Android precisa autorizar RECORD_AUDIO no sistema **e** conceder a permissão de microfone dentro do WebView. A camada Rust Tauri permite apenas a solicitação de microfone no WebView, sem conceder acesso à câmera/localização; o Android ainda pode mostrar seu prompt nativo de permissão. Testes em aparelhos reais continuam necessários para confirmar captura e áudio remoto.

## Download direto na release

O build na branch principal anexa também `AURORA-LIVES-Android-arm64-DEBUG.apk` à release `v0.0.7-preview` depois da geração de Windows/Linux. Este arquivo é **uma prévia de depuração**, assinado pelo runner com chave temporária: não garante atualizações sem reinstalar. O checksum separado `SHA256SUMS-ANDROID.txt` permite verificar a integridade do download.
