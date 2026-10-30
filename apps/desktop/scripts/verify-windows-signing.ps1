# Verifies the installed-app executable AND the NSIS installer. This is a
# release gate, not an advisory check. Unsigned/untrusted files fail the job.
param(
    [string]$TargetRoot = "src-tauri/target/release"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $IsWindows) {
    throw "A verificação Authenticode exige Windows."
}
$expected = $env:AURORA_CODESIGN_THUMBPRINT
if ([string]::IsNullOrWhiteSpace($expected)) {
    throw "O thumbprint da assinatura não foi definido. Não é permitido publicar um instalador sem assinatura."
}
$expected = ($expected -replace '\s','').ToUpperInvariant()

$signToolCommand = Get-Command "signtool.exe" -ErrorAction SilentlyContinue
$signTool = if ($signToolCommand) { $signToolCommand.Source } else { $null }
if (-not $signTool) {
    $kits = Join-Path ([Environment]::GetFolderPath("ProgramFilesX86")) "Windows Kits\10\bin"
    if (Test-Path -LiteralPath $kits) {
        $signTool = Get-ChildItem -Path $kits -Filter signtool.exe -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '[\\/]x64[\\/]signtool\.exe$' } |
            Sort-Object FullName -Descending |
            Select-Object -First 1 -ExpandProperty FullName
    }
}
if (-not $signTool) {
    throw "signtool.exe não encontrado no Windows SDK. A assinatura não pode ser verificada."
}

$app = Join-Path $TargetRoot "aurora-lives.exe"
$installerFolder = Join-Path $TargetRoot "bundle/nsis"
$installers = @(Get-ChildItem -Path $installerFolder -Filter "*.exe" -File -ErrorAction Stop)
if (-not (Test-Path -LiteralPath $app)) {
    throw "Executável nativo do Aurora não encontrado para validar a assinatura: $app"
}
if ($installers.Count -ne 1) {
    throw "Era esperado exatamente um instalador NSIS para validação; encontrados: $($installers.Count)."
}

foreach ($file in @((Get-Item -LiteralPath $app)) + $installers) {
    $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
    if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
        throw "Assinatura digital inválida ou não confiável: $($file.Name) — $($signature.Status)."
    }
    if (-not $signature.SignerCertificate -or
        $signature.SignerCertificate.Thumbprint.ToUpperInvariant() -ne $expected) {
        throw "O certificado que assinou $($file.Name) não corresponde ao certificado autorizado para esta release."
    }
    & $signTool verify /pa /all /v $file.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "O Windows SDK rejeitou a assinatura Authenticode de $($file.Name)."
    }
    Write-Host "Assinatura Authenticode válida e confiável: $($file.Name)"
}
Write-Host "Verificação concluída: executável e instalador assinados com o certificado autorizado."
