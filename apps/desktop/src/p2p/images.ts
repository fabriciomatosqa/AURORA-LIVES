import { IMAGE_CHUNK_SIZE, MAX_IMAGE_BASE64, validImageDataUrl, type ImageWirePart } from './protocol';

const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;

/** Resample locally to a small, safe JPEG/WebP before crossing a P2P data channel.
 * PNG is kept only if it fits within the same limit. Never upload to a server.
 */
export async function prepareChatImage(file: File): Promise<string> {
  if (!/^image\/(?:png|jpeg|webp)$/.test(file.type)) {
    throw new Error('Selecione uma imagem PNG, JPG ou WebP.');
  }
  if (file.size < 1 || file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new Error('A imagem original deve ter até 10 MB.');
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60_000_000) {
      throw new Error('A imagem é grande demais para processamento.');
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a imagem neste dispositivo.');
    for (const maxSide of [1280, 1000, 780, 600, 420]) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.67, 0.5]) {
        const data = canvas.toDataURL('image/webp', quality);
        if (validImageDataUrl(data)) return data;
        // WebViews without WebP encoding should still be able to send JPEG.
        const fallback = canvas.toDataURL('image/jpeg', quality);
        if (validImageDataUrl(fallback)) return fallback;
      }
    }
    throw new Error('A imagem não pôde ser reduzida para envio P2P (limite ~110 KB).');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function splitImageMessage(id: string, dataUrl: string, text: string, sentAt: number,
  senderId?: string): ImageWirePart[] {
  if (!validImageDataUrl(dataUrl)) throw new Error('Imagem inválida ou muito grande para envio.');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl)!;
  const payload = match[2];
  if (payload.length > MAX_IMAGE_BASE64) throw new Error('Imagem acima do limite.');
  const total = Math.ceil(payload.length / IMAGE_CHUNK_SIZE);
  return Array.from({ length: total }, (_, index) => ({
    type: 'image-part', id, index, total, mime: match[1] as ImageWirePart['mime'],
    data: payload.slice(index * IMAGE_CHUNK_SIZE, (index + 1) * IMAGE_CHUNK_SIZE),
    text, sentAt, ...(senderId ? { senderId } : {}),
  }));
}
