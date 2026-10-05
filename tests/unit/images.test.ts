import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { ImageValidationError, MAX_IMAGE_BYTES, sanitizeImage, validatedThumbnail } from '../../lib/image-validation';

test('real JPEG, PNG and WebP pixels are decoded, normalized, and retain their correct content types', async () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    const bytes = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#009988' } }).toFormat(format).toBuffer();
    const file = await validatedThumbnail(new File([new Uint8Array(bytes)], 'misleading.html', { type: `image/${format}` }));
    assert.ok(file); assert.equal(file.type, `image/${format}`); assert.match(file.name, /\.(jpg|png|webp)$/);
    const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
    assert.equal(metadata.width, 20); assert.equal(metadata.height, 10); assert.equal(metadata.format, format);
  }
});
test('active content, forged MIME/signatures, oversized images and damaged raster data are rejected', async () => {
  for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    Buffer.from('<html><script>alert(1)</script></html>'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]), Buffer.alloc(MAX_IMAGE_BYTES + 1)]) {
    await assert.rejects(sanitizeImage(bytes, 'image/png'), ImageValidationError);
  }
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).png().toBuffer();
  await assert.rejects(sanitizeImage(png, 'image/jpeg'), ImageValidationError);
  const large = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: '#ffffff' } }).png().toBuffer();
  await assert.rejects(sanitizeImage(large), ImageValidationError);
  const safe = await sanitizeImage(Buffer.concat([png, Buffer.from('<script>bad()</script>')]));
  assert.equal(safe.body.includes(Buffer.from('<script>')), false);
  assert.equal(await validatedThumbnail(null), null);
  await assert.rejects(validatedThumbnail('not a file'), ImageValidationError);
});
