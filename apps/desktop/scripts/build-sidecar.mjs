import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const goDir = resolve(desktopDir, '..', '..', 'services', 'api');
const binaryDir = resolve(desktopDir, 'src-tauri', 'binaries');
const triple = execFileSync('rustc', ['--print', 'host-tuple'], { encoding: 'utf8' }).trim();

if (!/^[A-Za-z0-9_-]+$/.test(triple)) {
  throw new Error('Target triple inválido: ' + triple);
}
mkdirSync(binaryDir, { recursive: true });
const suffix = process.platform === 'win32' ? '.exe' : '';
const output = resolve(binaryDir, `aurora-api-${triple}${suffix}`);
execFileSync('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', output, './cmd/aurora-api'], {
  cwd: goDir,
  stdio: 'inherit',
});
console.log('Serviço local integrado ao pacote:', output);
