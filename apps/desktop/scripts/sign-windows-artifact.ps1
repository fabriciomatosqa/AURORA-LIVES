# Sign Windows PE files with a trusted Authenticode certificate before release.
# This is intentionally fail-closed: an unsigned executable cannot be fixed by
# changing its hash or repackaging the installer.
param(
    [Parameter(Mandatory = $true)]
    [string] $FilePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
    throw "Arquivo de assinatura não encontrado: $FilePath"
}
if ([string]::IsNullOrWhiteSpace($env:WINDOWS_CODESIGN_PFX_BASE64) -or
    [string]::IsNullOrWhiteSpace($env:WINDOWS_CODESIGN_PFX_PASSWORD)) {
    throw "Publicação Windows bloqueada: configure WINDOWS_CODESIGN_PFX_BASE64 e WINDOWS_CODESIGN_PFX_PASSWORD com um certificado Authenticode emitido por autoridade confiável. Não desative Smart App Control."
}

$kits = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
if (-not (Test-Path -LiteralPath $kits)) {
    throw "Windows SDK e SignTool não estão disponíveis."
}
$signTool = Get-ChildItem -LiteralPath $kits -Filter signtool.exe -File -Recurse |
    Where-Object { $_.FullName -match '[\\/]x64[\\/]signtool\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
if (-not $signTool) { throw "SignTool x64 não foi encontrado no Windows SDK." }

$certificatePath = Join-Path $env:RUNNER_TEMP ("aurora-codesign-" + [guid]::NewGuid().ToString("N") + ".pfx")
try {
    $bytes = [Convert]::FromBase64String($env:WINDOWS_CODESIGN_PFX_BASE64)
    [System.IO.File]::WriteAllBytes($certificatePath, $bytes)
    Remove-Variable bytes -ErrorAction SilentlyContinue

    & $signTool.FullName sign /fd SHA256 /f $certificatePath /p $env:WINDOWS_CODESIGN_PFX_PASSWORD /tr "http://timestamp.digicert.com" /td SHA256 $FilePath
    if ($LASTEXITCODE -ne 0) { throw "SignTool falhou ao assinar $FilePath." }

    & $signTool.FullName verify /pa /all /v $FilePath
    if ($LASTEXITCODE -ne 0) { throw "Assinatura Authenticode não foi validada em $FilePath." }

    $signature = Get-AuthenticodeSignature -LiteralPath $FilePath
    if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate) {
        throw "Windows não confia na assinatura de $FilePath (status: $($signature.Status))."
    }
    Write-Host ("Assinatura válida. Publicador: " + $signature.SignerCertificate.Subject)
}
finally {
    if (Test-Path -LiteralPath $certificatePath) {
        Remove-Item -LiteralPath $certificatePath -Force
    }
}
