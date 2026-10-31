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


## Atualizações integradas (0.0.11)

O AURORA LIVES verifica o GitHub imediatamente ao abrir e de 2 em 2 horas enquanto está em execução em Windows, Linux e Android. Quando encontra uma versão mais nova, pergunta se deseja atualizar. Ao aceitar, baixa o arquivo oficial, exibe progresso, confere SHA-256 e inicia a instalação nativa.

Android: a versão 0.0.11 introduz o instalador de APK integrado por FileProvider. O sistema pode exigir permissão para instalar apps deste aplicativo e pedir confirmação. Não é possível burlar esse fluxo. **A assinatura do APK de atualização deve ser a mesma que assinou o aplicativo instalado.** Builds DEBUG antigos utilizam certificados temporários e NÃO podem ser atualizados para outra assinatura. Pode ser necessária uma reinstalação inicial para migrar à série com assinatura persistente.

Para lançar APKs atualizáveis, configure no GitHub Actions Secrets: `ANDROID_KEY_BASE64` (JKS/keystore persistente em base64), `ANDROID_KEY_PASSWORD` e `ANDROID_KEY_ALIAS`. O workflow assina somente builds release com essa chave; sem secrets, continua emitindo APK DEBUG apenas para teste, sem alegar compatibilidade de atualização. **Jamais versionar o arquivo .jks ou a senha.**

Os builds de Windows/Linux mantêm suas opções e mecanismos existentes. Os ciclos de atualização são apenas com o aplicativo aberto; não há execução em segundo plano após encerramento.


## Certificado permanente e migração Android (a partir da 0.0.15)

A mensagem **“Como o pacote tem um conflito com um pacote já existente”** indica que o pacote instalado e o novo APK usam certificados de assinatura diferentes, ainda que tenham o mesmo identificador `com.aurora.lives`. Nas versões 0.0.12 a 0.0.14, o GitHub Actions criou APKs DEBUG em máquinas temporárias, gerando certificados distintos. **Não é possível atualizar esses APKs uns sobre os outros apenas alterando o código.** O Android não permite desativar essa verificação.

### Configuração única obrigatória

1. Em um computador com JDK instalado, execute a partir da pasta `apps/desktop`: `python3 scripts/prepare-android-signing.py` (no Windows, `py scripts/prepare-android-signing.py`).
2. Os três valores ficam em `~/.aurora-lives-signing/`: `key.base64`, `password.txt`, `alias.txt`. Guarde também `aurora-lives.jks` e a senha em um backup offline protegido. Não compartilhe esses arquivos, nem os cole em conversas, commits ou issues.
3. No GitHub, abra `fabriciomatosqa/AURORA-LIVES` → **Settings → Secrets and variables → Actions → New repository secret** e crie:
   - `ANDROID_KEY_BASE64`: todo o conteúdo de `key.base64`;
   - `ANDROID_KEY_PASSWORD`: conteúdo de `password.txt`;
   - `ANDROID_KEY_ALIAS`: conteúdo de `alias.txt`.
4. No GitHub Actions, execute manualmente o workflow **AURORA LIVES Android — APK experimental e assinado** na branch `main`. Com a configuração concluída, o workflow publica `AURORA-LIVES-Android-arm64.apk` na release atual, com `ANDROID-CERT-SHA256.txt` para identificação pública do certificado.
5. Faça backup dos dados que desejar preservar. Desinstale uma única vez o APK DEBUG antigo e instale manualmente a primeira versão assinada. **Não desinstale sem antes preservar dados importantes.** A partir daí, atualizações subsequentes assinadas com a mesma chave poderão ser instaladas por cima da anterior, com autorização normal do Android.

Sem os três secrets, o CI ainda produz um APK DEBUG como artefato diagnóstico, mas **não o publica no GitHub Releases como uma atualização**. Isso evita induzir o usuário a baixar um APK incompatível.

### Teste seguro

Para testar atualização automática real, instale a primeira versão assinada (por exemplo, 0.0.15) e só então publique outra versão assinada com **a mesma keystore** (por exemplo, 0.0.16). A transição do APK DEBUG 0.0.14 diretamente para o assinado 0.0.15 não é suportada. O usuário pode ter de autorizar a instalação de apps desconhecidos e confirmar a instalação pelo Android.


## v0.0.17 — Fluxo Android inspirado no AURORA IPTV (sem modificar o IPTV)

Comparação em leitura com o código do repositório `fabriciomatosqa/iptv-player`. O IPTV restaura sempre a mesma identidade de assinatura, publica um APK com metadados verificados e checa a assinatura do APK na hora da instalação. O LIVES agora segue o mesmo protocolo funcional, mas usa **sua própria chave privada**, armazenada em `ANDROID_KEY_BASE64`, `ANDROID_KEY_PASSWORD` e `ANDROID_KEY_ALIAS` do repositório LIVES, nunca a chave do IPTV.

- O APK de atualização é `AURORA-LIVES-Android-arm64.apk` (sem DEBUG). O SHA-256 está em `SHA256SUMS-ANDROID.txt`. O manifesto `aurora-lives-update.json` publica packageName, versionName, versionCode, minSdk, tamanho, hash e hash público do certificado de assinatura, extraídos do APK real.
- O validador de publicação recusa assinatura, packageName, versão e versionCode inconsistentes. Antes de publicar a release, confere também se a fingerprint do certificado coincide com a primeira versão permanente já publicada.
- O aplicativo baixa apenas o arquivo oficial da release e valida SHA-256 em Rust. O instalador nativo Android confere pacote, versão crescente e **igualdade exata do certificado com o APK já instalado** antes de chamar o instalador do sistema. Se houver divergência, mostra mensagem clara sem tentar contornar a proteção.
- Se existir release mais nova, mas **sem APK Android assinado**, a interface informa que o APK está pendente em vez de declarar falsamente que o aparelho está atualizado.
- O APK continua sendo instalado com confirmação do sistema Android; instalação silenciosa sem privilégios especiais não é possível.

**Passo indispensável:** os 3 secrets da assinatura permanente precisam ser configurados uma única vez (veja o procedimento acima). O GitHub Actions não pode recuperar o certificado de DEBUG do aparelho nem obter a chave privada de outro repositório. Não é seguro copiar/armazenar uma chave de produção no cache público do Actions. Sem a chave, a compilação Android gera apenas artefato DEBUG de teste, que não pode ser anunciado como atualização. A versão já instalada 0.0.16 com uma chave diferente precisa ser substituída uma vez após backup. Depois, teste a transição **0.0.17 assinada → 0.0.18 assinada com a mesma chave**.
