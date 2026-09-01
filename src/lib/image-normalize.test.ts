// @vitest-environment node
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { normalizeImageUpload } from './image-normalize';

async function png(width: number, height: number): Promise<ArrayBuffer> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 232, g: 72, b: 127 } },
  }).png().toBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

const dims = async (bytes: ArrayBuffer) => {
  const m = await sharp(Buffer.from(bytes)).metadata();
  return { w: m.width, h: m.height, format: m.format };
};

describe('normalizeImageUpload', () => {
  it('downsizes an oversized general image to the 2000px box, as WebP', async () => {
    const out = await normalizeImageUpload(await png(4000, 3000), 'image/png', 'general');
    expect(out.processed).toBe(true);
    expect(out.contentType).toBe('image/webp');
    const { w, h, format } = await dims(out.bytes);
    expect(format).toBe('webp');
    expect(w).toBe(2000);
    expect(h).toBe(1500);
  });

  it('never upscales a small general image', async () => {
    const out = await normalizeImageUpload(await png(800, 600), 'image/png', 'general');
    const { w, h } = await dims(out.bytes);
    expect(w).toBe(800);
    expect(h).toBe(600);
  });

  it('hero preset cover-crops to exactly 1216x688', async () => {
    const out = await normalizeImageUpload(await png(3000, 3000), 'image/png', 'hero');
    const { w, h } = await dims(out.bytes);
    expect(w).toBe(1216);
    expect(h).toBe(688);
  });

  it('shrinks the payload dramatically for flat-colour photos', async () => {
    const original = await png(3000, 3000);
    const out = await normalizeImageUpload(original, 'image/png', 'general');
    expect(out.bytes.byteLength).toBeLessThan(original.byteLength);
  });

  it('passes through unprocessable content types untouched', async () => {
    const junk = new TextEncoder().encode('not an image').buffer as ArrayBuffer;
    const out = await normalizeImageUpload(junk, 'image/gif', 'general');
    expect(out.processed).toBe(false);
    expect(out.contentType).toBe('image/gif');
    expect(out.bytes.byteLength).toBe(junk.byteLength);
  });

  it('fails open on undecodable bytes with a processable type', async () => {
    const junk = new TextEncoder().encode('garbage bytes here').buffer as ArrayBuffer;
    const out = await normalizeImageUpload(junk, 'image/jpeg', 'general');
    expect(out.processed).toBe(false);
    expect(out.bytes.byteLength).toBe(junk.byteLength);
  });
});
