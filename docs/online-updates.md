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
