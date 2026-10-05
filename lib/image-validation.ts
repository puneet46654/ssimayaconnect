import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export class ImageValidationError extends Error {}
const TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** Decode and re-encode approved raster formats; never return uploaded markup or embedded metadata. */
export async function sanitizeImage(bytes: Uint8Array, declaredType?: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new ImageValidationError('Choose an image no larger than 5 MB.');
  const input = Buffer.from(bytes);
  const signature = input.subarray(0, 12);
  const format = signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
    : signature[0] === 255 && signature[1] === 216 && signature[2] === 255 ? 'jpeg'
    : signature.toString('ascii', 0, 4) === 'RIFF' && signature.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  if (!format || declaredType !== undefined && declaredType !== TYPES[format]) {
    throw new ImageValidationError('Choose a genuine JPG, PNG or WebP image with a matching file type.');
  }
  try {
    const image = sharp(input, { failOn: 'warning', limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages || 1) > 1) throw new Error('Unsupported image.');
    const output = await image.rotate().toFormat(format).toBuffer();
    if (output.length > MAX_IMAGE_BYTES) throw new ImageValidationError('Choose an image no larger than 5 MB.');
    return { body: output, contentType: TYPES[format], extension: format === 'jpeg' ? 'jpg' : format };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError('The image is damaged, animated, or exceeds 25 megapixels. Choose another JPG, PNG or WebP image.');
  }
}

export async function validatedThumbnail(value: FormDataEntryValue | null): Promise<File | null> {
  if (value === null || value === '' || value instanceof File && !value.name && !value.size) return null;
  if (!(value instanceof File)) throw new ImageValidationError('Choose a JPG, PNG or WebP image file.');
  if (value.size > MAX_IMAGE_BYTES) throw new ImageValidationError('Choose an image no larger than 5 MB.');
  const image = await sanitizeImage(new Uint8Array(await value.arrayBuffer()), value.type);
  return new File([new Uint8Array(image.body)], `thumbnail.${image.extension}`, { type: image.contentType });
}
