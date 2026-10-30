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
