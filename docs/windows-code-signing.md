# AURORA LIVES — Assinatura digital confiável no Windows

## Situação

A versão **0.0.6 está preparada, mas NÃO assinada nem publicada** até que exista um certificado Authenticode válido, emitido por autoridade de certificação confiável pelo Windows. A versão pública atual segue sendo 0.0.5.

Não gere um certificado autoassinado: ele não cria a reputação de confiança necessária para o Controle Inteligente de Aplicativos do Windows 11. Um simples checksum SHA-256 também não substitui assinatura de código.

## Credenciais necessárias

Esta implementação usa um certificado **AuthentiCode Code Signing com chave privada exportável em PFX protegido por senha**. Não usa segredo no arquivo de configuração do Tauri.

Os certificados de código emitidos atualmente por diversas autoridades usam HSM/token e **podem não permitir exportar um PFX**. Nesse caso, não tente extrair a chave privada: será necessário adaptar a integração à assinatura remota do emissor ou ao Azure Artifact Signing. A escolha do fornecedor e a verificação de identidade precisam ser feitas pelo proprietário.

### Configuração de GitHub Secrets

Acesse o repositório [fabriciomatosqa/AURORA-LIVES](https://github.com/fabriciomatosqa/AURORA-LIVES) → **Settings → Secrets and variables → Actions → New repository secret**, e crie:

1. `AURORA_CODESIGN_PFX_BASE64` — **conteúdo Base64 do arquivo .pfx** de um certificado público confiável de assinatura de código, incluindo chave privada.
2. `AURORA_CODESIGN_PFX_PASSWORD` — senha usada ao exportar o PFX.

Para preparar o Base64 em PowerShell local no Windows (NÃO colocar em README, commit, issue, chat ou log):

```powershell
$cert = "C:\caminho\seguro\certificado.pfx"
[Convert]::ToBase64String([IO.File]::ReadAllBytes($cert)) | Set-Clipboard
```

Cole o conteúdo no formulário do GitHub Secret e limpe o clipboard depois. Guarde o PFX original em armazenamento seguro. Para certificados de hardware ou gerenciados por serviços remotos, use o procedimento da autoridade emissora em vez de PFX.

## Como funciona no GitHub Actions

1. No Windows, o script `apps/desktop/scripts/prepare-windows-signing.ps1` exige os dois Secrets. Sem eles **a compilação de release Windows falha antes de iniciar**.
2. O script importa o PFX temporariamente em `Cert:\CurrentUser\My`, verifica prazo de validade, chave privada, finalidade EKU de Code Signing e cadeia de confiança.
3. Gera `apps/desktop/src-tauri/tauri.signing.generated.json` apenas no runner, com o thumbprint do certificado, assinatura SHA-256 e timestamp RFC 3161. O PFX temporário é apagado.
4. O `tauri build` utiliza essa configuração para assinar o aplicativo nativo e o instalador NSIS.
5. O script `apps/desktop/scripts/verify-windows-signing.ps1` exige **assinatura Authenticode válida do executável e do instalador**, com o mesmo certificado, verificando também via `signtool verify /pa /all /v`.
6. Só depois o instalador é enviado para o artifact. A publicação GitHub Release depende da aprovação dos jobs Windows e Linux.
7. Um teste de segurança do CI assegura que sem credenciais a preparação e a validação da assinatura não passam.

Não há *fallback* para binário Windows sem assinatura. O release só aparecerá na seção Releases depois de passar pelas validações.

## Cuidados

- **Nunca** enviar PFX, senha, certificado privado ou credenciais para ChatGPT.
- O SHA-256 do release deve ser recalculado **depois** da assinatura, pois a assinatura altera os bytes do instalador.
- O certificado deve ter cadeia confiável e a finalidade **Code Signing (OID 1.3.6.1.5.5.7.3.3)**.
- O timestamp RFC 3161 depende de conectividade de rede para o servidor de timestamp e precisa funcionar no build.
- A assinatura melhora a confiança no Windows, mas não garante ausência de qualquer alerta de SmartScreen em todos os computadores.
- O usuário não deve desativar Smart App Control para testar instaladores não confiáveis.

## Publicação da 0.0.6

Após cadastrar Secrets válidos, executar e validar o workflow de assinatura, completar o merge da PR na `main`. A automação publicará `v0.0.6-preview` com instaladores `.exe`, `.deb` e `SHA256SUMS.txt` apenas se todos os requisitos passarem.

## Referências oficiais

- [Assinatura de código Windows no Tauri 2](https://v2.tauri.app/distribute/sign/windows/)
- [Microsoft — Smart App Control](https://support.microsoft.com/pt-br/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions)
