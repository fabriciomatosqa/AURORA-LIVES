# Windows 11 Smart App Control — assinatura do AURORA LIVES

## Comparação das versões 0.0.31 e 0.0.32

A comparação `v0.0.31-preview...v0.0.32-preview` confirma que **nenhum arquivo de empacotamento ou workflow Windows foi alterado**. Ambas as versões foram publicadas sem assinatura digital confiável; o próprio texto das duas releases avisava dessa limitação. O `aurora-lives.exe` foi recompilado com funcionalidades novas, o que resulta em outro hash. O Windows pode aceitar um executável unsigned já conhecido e bloquear outro cuja reputação não é suficiente. Não existe uma alteração de UI/720p60 capaz de conceder confiança ao novo binário.

Referências oficiais:
- https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions
- https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options

## Alteração de segurança no pipeline

O workflow `.github/workflows/installer.yml` agora exige assinatura Authenticode **do executável Tauri antes de empacotá-lo e do instalador Inno Setup depois de empacotá-lo**. Valida a cadeia de certificados com `signtool verify /pa /all` e `Get-AuthenticodeSignature`. Ausência de credenciais, assinatura inválida, certificado autoassinado não confiável ou qualquer erro de verificação **impedem o release automático do Windows**. A chave é temporária no runner e excluída no bloco `finally`. O fluxo da versão Android, sua assinatura e o aplicativo Linux não foram modificados.

A mudança no workflow **não torna o instalador 0.0.32 já publicado confiável**. Para disponibilizar um binário executável em PCs com Smart App Control, é necessário publicar uma nova versão assinada com identidade de confiança (por exemplo, `0.0.33`).

### Pré-requisitos do proprietário do certificado

1. Obter certificado Authenticode para distribuição pública emitido por AC confiável, com chave utilizável em CI; certificados autoassinados **não** são solução para usuários finais. Para empresas/certificados com HSM ou token, usar mecanismo seguro de assinatura do provedor; nem todos fornecem chave exportável PFX.
2. **Somente para certificados cujo emissor permite exportação segura em PFX**, configurar segredos de repositório no GitHub Actions:
   - `WINDOWS_CODESIGN_PFX_BASE64`: representação Base64 do certificado PFX, com a chave privada.
   - `WINDOWS_CODESIGN_PFX_PASSWORD`: senha do PFX.
3. Nunca publicar PFX/senha, nem adicionar a arquivos do projeto, commits, relatórios, logs ou chats. O workflow só recebe os segredos no runner Windows.
4. Publicar nova versão de teste, executar o workflow, confirmar `SignTool verify /pa /all` para ambos os binários e testar diretamente em um computador com Smart App Control ativo. O selo/assinatura não substitui a análise de reputação do Smart App Control e não garante liberação em todas as máquinas.

**Limitação regional:** Azure Artifact Signing possui restrições de elegibilidade geográfica (incluindo para pessoas físicas no Brasil); consulte os requisitos oficiais antes de escolher. Um certificado OV de AC confiável ou pacote MSIX distribuído pela Microsoft Store são alternativas, cada qual com pré-requisitos próprios.

**Proteção:** Não desative o Smart App Control para fazer o AURORA funcionar. Não existe exceção individual por aplicativo nesse recurso. O hash SHA-256 da release garante integridade, mas não identifica de modo independente o publicador.

### Recuperação da máquina afetada

O executável da versão `0.0.32` já instalado e sem assinatura continuará bloqueado, mesmo que uma versão futura seja assinada. Para recuperação, instale **uma versão comprovadamente assinada e confiável**, quando estiver publicada. O usuário pode usar temporariamente a `0.0.31` se ela ainda for aceita nesse Windows, mas isso não garante execução em todos os dispositivos.
