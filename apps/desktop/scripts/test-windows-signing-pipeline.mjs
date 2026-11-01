import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const base = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(resolve(base, '.github/workflows/installer.yml'), 'utf8');
const signer = readFileSync(resolve(base, 'apps/desktop/scripts/sign-windows-artifact.ps1'), 'utf8');

const compile = workflow.indexOf('Compilar executável Tauri Windows');
const signedExe = workflow.indexOf('Assinar executável Windows (certificado confiável obrigatório)');
const inno = workflow.indexOf('Criar instalador Inno Setup por usuário');
const signedInstaller = workflow.indexOf('Assinar instalador Windows (certificado confiável obrigatório)');
const upload = workflow.indexOf('Guardar instalador');

assert.ok(compile >= 0 && compile < signedExe, 'O executável deve ser assinado após compilar');
assert.ok(signedExe < inno && inno < signedInstaller && signedInstaller < upload,
  'O EXE deve ser assinado antes do Inno Setup; o instalador antes do upload');
assert.equal((workflow.match(/scripts\/sign-windows-artifact\.ps1/g) || []).length, 2,
  'Assinar ambos: aurora-lives.exe e instalador');
assert.match(workflow, /WINDOWS_CODESIGN_PFX_BASE64:\s*\$\{\{ secrets\.WINDOWS_CODESIGN_PFX_BASE64 \}\}/);
assert.match(workflow, /WINDOWS_CODESIGN_PFX_PASSWORD:\s*\$\{\{ secrets\.WINDOWS_CODESIGN_PFX_PASSWORD \}\}/);
assert.match(signer, /signtool/i);
assert.match(signer, /verify \/pa \/all/);
assert.match(signer, /Get-AuthenticodeSignature/);
assert.match(signer, /throw "Publicação Windows bloqueada:/);
assert.match(signer, /Remove-Item.*certificatePath/);
console.log('Windows: compilação, assinatura Authenticode, verificação e upload encadeados com fail-closed.');
