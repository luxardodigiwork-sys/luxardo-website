import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compressForWeb } from '../src/utils/imageCompress';

async function withCanvas(width: number, height: number, webp: boolean, check: (state: any) => Promise<void>) {
  const state = { width: 0, height: 0, closed: false, draws: 0 };
  const oldBitmap = globalThis.createImageBitmap;
  const oldDocument = globalThis.document;
  (globalThis as any).createImageBitmap = async () => ({ width, height, close() { state.closed = true; } });
  (globalThis as any).document = { createElement() { return {
    set width(v: number) { state.width = v; },
    set height(v: number) { state.height = v; },
    getContext() { return { drawImage() { state.draws++; } }; },
    toBlob(callback: (b: Blob) => void, type: string) {
      callback(new Blob(['encoded-photo'], { type: type === 'image/webp' && !webp ? 'image/png' : type }));
    },
  }; } };
  try { await check(state); } finally {
    if (oldBitmap === undefined) delete (globalThis as any).createImageBitmap; else globalThis.createImageBitmap = oldBitmap;
    if (oldDocument === undefined) delete (globalThis as any).document; else globalThis.document = oldDocument;
  }
}

test('portrait camera upload caps the longest edge and matches encoded type to filename', async () => {
  await withCanvas(3000, 6000, true, async state => {
    const out = await compressForWeb(new File(['original'], 'portrait.jpg'));
    assert.equal(state.width, 1000);
    assert.equal(state.height, 2000);
    assert.equal(state.draws, 1);
    assert.equal(state.closed, true);
    assert.equal(out.type, 'image/webp');
    assert.equal(out.name, 'portrait.webp');
  });
});

test('small images are never upscaled', async () => {
  await withCanvas(640, 480, true, async state => {
    await compressForWeb(new File(['original'], 'small.png'));
    assert.equal(state.width, 640);
    assert.equal(state.height, 480);
  });
});

test('browsers without WebP encoding get a JPEG filename and content type', async () => {
  await withCanvas(4000, 2000, false, async state => {
    const out = await compressForWeb(new File(['original'], 'banner.png'), { maxEdge: 1920 });
    assert.equal(state.width, 1920);
    assert.equal(state.height, 960);
    assert.equal(out.type, 'image/jpeg');
    assert.equal(out.name, 'banner.jpg');
  });
});
