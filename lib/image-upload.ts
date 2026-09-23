export async function prepareImageForUpload(file: File, maxBytes = 800 * 1024) {
  if (file.size <= maxBytes) {
    return file;
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to read the selected image.'));
      img.src = sourceUrl;
    });

    const canvas = document.createElement('canvas');
    let scale = 1;
    let quality = 0.8;
    // JPEG compression is effective for PNG/WebP files too. Keeping PNG here
    // can leave large images unchanged because canvas ignores JPEG quality for PNG.
    const targetType = 'image/jpeg';

    const maxDimension = 1600;

    const convert = (currentScale: number, currentQuality: number, currentType: string) =>
      new Promise<File>((resolve, reject) => {
        const width = Math.max(1, Math.round(image.width * currentScale));
        const height = Math.max(1, Math.round(image.height * currentScale));

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('Canvas is not available in this browser.'));
          return;
        }

        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Unable to compress the selected image.'));
              return;
            }

            resolve(
              new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}.jpg`, {
                type: currentType,
                lastModified: Date.now(),
              }),
            );
          },
          currentType,
          currentQuality,
        );
      });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const compressed = await convert(scale, quality, targetType).catch(() => null);

      if (compressed && compressed.size <= maxBytes) {
        return compressed;
      }

      scale *= 0.82;
      quality *= 0.72;

      if (scale < 0.35) {
        break;
      }
    }

    const reduced = await convert(
      Math.min(0.35, maxDimension / Math.max(image.width, image.height)),
      0.45,
      targetType,
    );

    if (reduced.size <= maxBytes) {
      return reduced;
    }

    throw new Error(
      'The selected image is too large. Please choose a smaller image.',
    );
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
