# Atualizações integradas — AURORA LIVES v0.0.5

## Funcionamento

O aplicativo instalado em Windows e Linux consulta automaticamente, ao abrir, o endpoint público de Releases do repositório fabriciomatosqa/AURORA-LIVES. Repete a consulta a cada **6 horas** enquanto permanecer aberto. A opção **Configurações → Atualizações online → Verificar atualizações** permite consultar manualmente.

O programa procura a maior versão semântica publicada, incluindo pré-lançamentos com tag `vX.Y.Z-preview` (nome correspondente à versão `X.Y.Z` instalada). Versões em rascunho, incompletas ou inferiores à atual são ignoradas. A atualização aparece em aviso na barra superior e em Configurações.

## Atualizar pelo programa

1. Abra **Configurações → Atualizações online**.
2. Se houver versão nova, clique em **Baixar atualização**.
3. Acompanhe o progresso. O programa só aceitará o instalador oficial do release esperado para Windows ou Linux.
4. O arquivo é conferido com o `SHA256SUMS.txt` do mesmo release.
5. Clique em **Instalar atualização**. O programa pede confirmação se houver uma sala em andamento.
6. No **Windows**, abre o instalador `.exe` (NSIS) e o AURORA LIVES fecha; siga eventuais avisos do Windows.
7. No **Linux Ubuntu/Debian**, abre o `.deb` com o programa associado pelo sistema (`xdg-open`). O usuário autoriza a instalação quando solicitada, inclusive senha administrativa.

**A versão 0.0.4 e anteriores não têm esse recurso. É preciso instalar 0.0.5 uma vez pelo GitHub.** Futuras versões serão encontradas no programa.

## Segurança e limites

- Nenhuma conta GitHub ou token é necessário. Apenas HTTPS para api.github.com e downloads oficiais do github.com.
- O código Rust recusa URLs arbitrárias do frontend, nomes de arquivos inesperados, versões inferiores/iguais à instalada, releases em rascunho, instaladores superiores a 250 MB ou arquivos com SHA-256 divergente.
- Downloads parciais têm extensão `.part` e não são executados. A instalação só é habilitada após baixar e conferir o instalador na sessão atual.
- Nenhuma instalação ocorre silenciosamente.
- SHA-256 detecta corrupção, mas porque checksum e instalador estão na mesma conta GitHub, isso não equivale à assinatura criptográfica independente. Os executáveis de prévia seguem sem certificado de assinatura de código. Para atualizar de forma assinada pelo Tauri, é necessário configurar chaves privadas em GitHub Actions Secrets, nunca em arquivos públicos.
- Uma consulta offline falha sem interromper chat, voz ou vídeo.
- Atualizador não cria servidor dedicado: a arquitetura P2P da sala permanece.
- O workflow de release calcula a tag do package.json. É preciso aumentar as versões em package.json, tauri.conf.json e Cargo.toml em cada novo release.

## Testes

- cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml: parser SemVer, seleção de release, recusa de fontes externas, limites e SHA-256.
- npm run test: renderização dos botões e estados de atualização, além dos testes P2P.
- CI compila Tauri em Windows/Linux. Testes reais de instalação requerem computadores com Windows/Linux e a publicação de uma versão posterior à 0.0.5.

O programa não deve declarar que a instalação terminou antes de a nova versão ser aberta.


## Atualizações no padrão AURORA AutoFill (0.0.6)

Implementado exclusivamente no repositório AURORA LIVES, após consulta **somente leitura** ao projeto AutoFill:

- Consulta GitHub Releases ao iniciar e a cada seis horas; botão de verificação manual.
- Aviso com **Sim, atualizar / Não, depois**. Ao adiar, reaparece após 3 horas ou quando houver outra versão mais nova. O estado de adiamento é salvo apenas localmente.
- Canal de pré-lançamentos habilitado por padrão, com preferência persistida para receber apenas releases estáveis se desejar.
- Download em streaming, progresso percentual, cancelamento, limite de tamanho e rejeição de arquivos incompletos.
- Verificação do manifesto `SHA256SUMS.txt` publicado com o release e, quando o GitHub oferece metadado digest, comparação adicional do SHA-256.
- Segue URLs de redirecionamento somente por HTTPS para os domínios oficiais do GitHub usados nos assets.
- Windows: instalador **Inno Setup** por usuário, flags `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /AURORAUPDATE=1`, aplicado somente após aprovação do usuário; em uma sala ativa, pede confirmação.
- Linux: gerenciador de pacotes via `xdg-open` com confirmação do sistema.

**Atenção:** a série até 0.0.5 usava NSIS. Inno Setup possui identidade de instalação distinta, de modo que uma instalação pré-existente pode ser listada separadamente no Windows. Remova a instalação NSIS antiga pelo próprio Windows se necessário, depois de instalar a nova. Não removemos dados pessoais na compilação.

**Segurança:** SHA-256 protege a integridade do arquivo baixado mas não substitui assinatura independente. Tanto o AutoFill atual como esta distribuição do LIVES são **não assinados** e podem sofrer bloqueio por Smart App Control, mesmo quando o download é feito dentro do app. Não recomende desativar proteção do sistema.

Esta implementação não utiliza a Microsoft Store, certificados pagos, servidor dedicado ou qualquer modificação no repositório AutoFill.


**Transição NSIS → Inno Setup:** a versão 0.0.5 ainda abre o instalador no modo interativo. Ao atualizar da 0.0.5 para a 0.0.6, conclua o assistente Inno Setup manualmente. A partir da 0.0.6, o comando automático do Inno Setup é usado com confirmação prévia no aplicativo. Uma versão antiga instalada por NSIS pode continuar aparecendo separadamente em Aplicativos instalados.


## Correção do fluxo em um clique (0.0.9)

- **Causa:** a distribuição 0.0.7/0.0.8 foi compilada sem autorização `core:event:allow-listen` e `core:event:allow-unlisten`; a tentativa de acompanhar `aurora:update-progress` falhava com `Command plugin:event|listen not allowed by ACL` antes mesmo de começar o download.
- **Correção:** capability explícita para a janela principal e fallback de progresso indeterminado caso ouvir eventos seja bloqueado. Em Configurações e no aviso de nova versão, um clique inicia download, verificação SHA-256 e execução do instalador verificado. Botões de confirmação internos foram removidos. A tela exibe o percentual enquanto o download acontece.
- **Windows:** Inno Setup recebe `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /AURORAUPDATE=1`; não precisa confirmar novamente no aplicativo. Proteções de segurança do Windows podem bloquear executáveis não assinados.
- **Linux (Debian/Ubuntu):** inicia `pkexec /usr/bin/dpkg -i <arquivo-verificado>` após o download. O programa não apresenta uma segunda confirmação, mas o PolicyKit do sistema pode exigir autenticação administrativa. Sem permissões suficientes, nenhum aplicativo pode instalar um .deb silenciosamente em nível de sistema.
- **Android:** o APK experimental continua sem atualizador integrado. Instalação silenciosa não é garantida pelo Android; são necessários assinatura persistente entre builds e API de instalação de pacotes, que pode exigir consentimento do sistema. O aplicativo oferece link direto ao GitHub até isso ser implementado. O build de APK debug criado com chave temporária pode exigir desinstalação anterior, com perda potencial dos dados locais, portanto faça backup antes de reinstalar.
- **Migração:** binários 0.0.7 e 0.0.8 já instalados **não** recebem essa correção remotamente. É necessária uma instalação manual única da 0.0.9. Depois, testar a transição 0.0.9 → 0.0.10 em Windows e Linux; apenas a compilação não comprova a instalação silenciosa ponta-a-ponta.
- **Integridade:** manter downloads exclusivamente de releases oficiais com SHA-256; não aceitar URLs arbitrárias e não sugerir desligar proteção do sistema.


## Atualizações integradas (0.0.11)

O AURORA LIVES verifica o GitHub imediatamente ao abrir e de 2 em 2 horas enquanto está em execução em Windows, Linux e Android. Quando encontra uma versão mais nova, pergunta se deseja atualizar. Ao aceitar, baixa o arquivo oficial, exibe progresso, confere SHA-256 e inicia a instalação nativa.

Android: a versão 0.0.11 introduz o instalador de APK integrado por FileProvider. O sistema pode exigir permissão para instalar apps deste aplicativo e pedir confirmação. Não é possível burlar esse fluxo. **A assinatura do APK de atualização deve ser a mesma que assinou o aplicativo instalado.** Builds DEBUG antigos utilizam certificados temporários e NÃO podem ser atualizados para outra assinatura. Pode ser necessária uma reinstalação inicial para migrar à série com assinatura persistente.

Para lançar APKs atualizáveis, configure no GitHub Actions Secrets: `ANDROID_KEY_BASE64` (JKS/keystore persistente em base64), `ANDROID_KEY_PASSWORD` e `ANDROID_KEY_ALIAS`. O workflow assina somente builds release com essa chave; sem secrets, continua emitindo APK DEBUG apenas para teste, sem alegar compatibilidade de atualização. **Jamais versionar o arquivo .jks ou a senha.**

Os builds de Windows/Linux mantêm suas opções e mecanismos existentes. Os ciclos de atualização são apenas com o aplicativo aberto; não há execução em segundo plano após encerramento.


## Android 0.0.14 — Correção de detecção de APK DEBUG

Versões Android 0.0.12 e 0.0.13 procuravam somente `AURORA-LIVES-Android-arm64.apk`. Quando o workflow não tinha uma chave de assinatura persistente, ele publicava somente `AURORA-LIVES-Android-arm64-DEBUG.apk`, e a consulta retornava falsamente “Você já está usando a versão mais recente”. A partir da 0.0.14, o atualizador prioriza o APK assinado, mas aceita o APK DEBUG exato e seu manifesto SHA256SUMS-ANDROID.txt como alternativa experimental, sem relaxar o bloqueio de URLs externas ou hashes inválidos. O aplicativo mostra aviso sobre assinatura e dados locais.

**Atenção:** a versão 0.0.12 instalada já contém a falha de consulta, então precisará de uma instalação manual única para ativar o novo mecanismo. Assinaturas diferentes impedem instalação sobre o pacote anterior. O APK DEBUG experimental NÃO é uma solução de assinatura; a correção definitiva continua dependendo de configurar um keystore persistente no workflow de releases. Nunca desative verificações de assinatura.


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


## Assinatura Android automática de TESTE (mesma estratégia do AURORA IPTV)

A primeira compilação da branch principal gera uma chave de **teste** própria em `apps/desktop/.signing`, excluída do Git. O GitHub Actions a conserva no cache específico `aurora-lives-android-test-signing-v1` e a restaura nos builds seguintes. Se o cache se perder, o job usa os três Secrets da assinatura original, quando disponíveis. Se já foi publicado um APK com assinatura e não houver a chave original, o workflow **falha** em vez de criar uma assinatura incompatível.

A execução de pull requests não acessa o cache de assinatura; usa APK DEBUG descartável. O APK com assinatura de teste persistente é distribuído em releases como `AURORA-LIVES-Android-arm64.apk` e verificado por SHA-256, metadados e fingerprint de certificado.

**Limitação importante:** o Actions Cache não é backup duradouro/seguro de chave privada e pode expirar ou ser removido. O processo replica o fluxo de testes do IPTV, mas NÃO fornece uma solução de assinatura de produção. Mantenha uma cópia privada protegida da chave se quiser continuidade garantida. A identidade criada inicialmente não é a mesma dos APKs anteriores: uma reinstalação inicial após backup poderá ser necessária. As atualizações posteriores só funcionam enquanto a mesma chave for preservada. A instalação poderá exigir confirmação do Android.
