// Re-encode identity photos without carrying over the source file's metadata.
export async function preparePhoto(file, longestEdge) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (bitmap.width * bitmap.height > 60000000) {
      throw new Error('A resolução da fotografia é demasiado alta.');
    }
    const scale = Math.min(1, longestEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a fotografia.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!image?.size) throw new Error('Não foi possível preparar a fotografia.');
    return image;
  } finally {
    bitmap.close();
  }
}
