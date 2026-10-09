/**
 * One way to prepare a photo for the website, used by both the admin upload
 * box and Admin → Photo Optimizer: longest side capped (2000px by default),
 * WebP at ~85% quality, EXIF rotation respected. A 20 MB camera photo ends
 * up a few hundred KB and looks the same on screen.
 */
export async function compressForWeb(
  input: Blob,
  opts: { maxEdge?: number; quality?: number; name?: string } = {},
): Promise<File> {
  const maxEdge = opts.maxEdge ?? 2000;
  const quality = opts.quality ?? 0.85;
  const baseName = (opts.name || (input as File).name || 'photo').replace(/\.[^.]+$/, '');

  const bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' } as any);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
  let out = await toBlob('image/webp');
  // Very old browsers can't write WebP (they silently return PNG) — use JPEG.
  if (!out || out.type !== 'image/webp') out = await toBlob('image/jpeg');
  if (!out) throw new Error('Could not encode image');
  const ext = out.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([out], `${baseName}.${ext}`, { type: out.type });
}
