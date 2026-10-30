# Prepares a trusted Authenticode certificate for a Windows Tauri/NSIS release.
# This script must fail closed: an unsigned installer must NEVER be published
# by the official release workflow.
param(
    [string]$ConfigPath = "src-tauri/tauri.signing.generated.json"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$pfxBase64 = $env:AURORA_CODESIGN_PFX_BASE64
$pfxPassword = $env:AURORA_CODESIGN_PFX_PASSWORD

if ([string]::IsNullOrWhiteSpace($pfxBase64) -or
    [string]::IsNullOrWhiteSpace($pfxPassword)) {
    throw "Assinatura obrigatória: configure os Secrets AURORA_CODESIGN_PFX_BASE64 e AURORA_CODESIGN_PFX_PASSWORD. Nenhum instalador Windows será publicado sem certificado válido."
}

if (-not $IsWindows) {
    throw "A importação e validação Authenticode precisam ocorrer em um runner Windows."
}

try {
    $pfxBytes = [Convert]::FromBase64String($pfxBase64)
} catch {
    throw "O Secret AURORA_CODESIGN_PFX_BASE64 não contém um PFX Base64 válido."
}

$tempRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$pfxPath = Join-Path $tempRoot ("aurora-signing-" + [Guid]::NewGuid().ToString("N") + ".pfx")
try {
    [IO.File]::WriteAllBytes($pfxPath, $pfxBytes)
    $securePassword = ConvertTo-SecureString $pfxPassword -AsPlainText -Force
    $imported = @(Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation "Cert:\CurrentUser\My" -Password $securePassword -ErrorAction Stop)
} catch {
    throw "Não foi possível importar o certificado PFX. Confirme o formato, a senha e a disponibilidade da chave privada."
} finally {
    if (Test-Path -LiteralPath $pfxPath) {
        Remove-Item -LiteralPath $pfxPath -Force -ErrorAction SilentlyContinue
    }
    # Do not retain decoded PFX bytes longer than needed.
    $pfxBytes = $null
}

$codesigningOid = "1.3.6.1.5.5.7.3.3"
$candidates = @($imported | Where-Object {
    if (-not $_.HasPrivateKey) { return $false }
    $eku = @($_.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.37" })
    if ($eku.Count -ne 1) { return $false }
    @($eku[0].EnhancedKeyUsages | Where-Object { $_.Value -eq $codesigningOid }).Count -gt 0
})
if ($candidates.Count -ne 1) {
    throw "O PFX deve conter exatamente um certificado com chave privada e uso permitido para assinatura de código (EKU Code Signing)."
}
$cert = $candidates[0]
$now = [DateTime]::UtcNow
if ($now -lt $cert.NotBefore.ToUniversalTime() -or $now -gt $cert.NotAfter.ToUniversalTime()) {
    throw "O certificado de assinatura está fora da validade."
}

# Self-signed local certificates, untrusted issuers and broken chains must fail.
$chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
try {
    $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::Online
    $chain.ChainPolicy.RevocationFlag = [System.Security.Cryptography.X509Certificates.X509RevocationFlag]::EndCertificateOnly
    $chain.ChainPolicy.VerificationFlags = [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::NoFlag
    $chain.ChainPolicy.UrlRetrievalTimeout = [TimeSpan]::FromSeconds(15)
    if (-not $chain.Build($cert)) {
        throw "O certificado não possui uma cadeia confiável e verificável no Windows. Certificados autoassinados não resolvem o Smart App Control."
    }
} finally {
    $chain.Dispose()
}

$thumbprint = ($cert.Thumbprint -replace '\s', '').ToUpperInvariant()
$config = @{
    bundle = @{
        windows = @{
            certificateThumbprint = $thumbprint
            digestAlgorithm = "sha256"
            timestampUrl = "http://timestamp.digicert.com"
            tsp = $true
        }
    }
}
$absoluteConfig = [IO.Path]::GetFullPath((Join-Path (Get-Location).Path $ConfigPath))
$directory = Split-Path -Parent $absoluteConfig
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $absoluteConfig -Encoding utf8

if ($env:GITHUB_ENV) {
    Add-Content -LiteralPath $env:GITHUB_ENV -Value "AURORA_CODESIGN_THUMBPRINT=$thumbprint"
}
Write-Host "Certificado de assinatura de código confiável importado. Configuração Tauri gerada com segurança."
Write-Host "O instalador e o executável serão verificados após o empacotamento."
