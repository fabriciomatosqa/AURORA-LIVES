// Verifica que TODOS os usos da identidade AURORA LIVES utilizam
// exatamente o PNG original fornecido pelo autor, não versões redesenhadas.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const EXPECTED_SHA256 = '230aafa4ba6aaf9d5d65d30e4ae725fb1b246e20e95a835bac998d18cb3498a7';
const targets = [
  new URL('../../../assets/branding/Emblema Triangular Neon Cristalino.png', import.meta.url),
  new URL('../public/aurora-mark.png', import.meta.url),
  new URL('../src-tauri/icons/source.png', import.meta.url)
];

for (const url of targets) {
  const image = readFileSync(url);
  const name = url.pathname;
  if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('Arquivo de logo inválido (não é PNG): ' + name);
  }
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (width !== 1254 || height !== 1254) {
    throw new Error('Resolução diferente da imagem original em ' + name + ': ' + width + 'x' + height);
  }
  const sha = createHash('sha256').update(image).digest('hex');
  if (sha !== EXPECTED_SHA256) {
    throw new Error('A logo foi alterada/substituída: ' + name);
  }
  console.log('Logo original verificada: ' + decodeURIComponent(name));
}
