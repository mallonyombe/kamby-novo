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

// Show the framing used by the destination before writing the image.
export function previewPhoto(file, title, framing = 'avatar') {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const dialog = document.createElement('dialog');
    dialog.className = 'local-data-dialog photo-preview-dialog';
    dialog.dataset.framing = framing;
    dialog.setAttribute('aria-label', title);

    const heading = document.createElement('h2');
    heading.textContent = title;
    const frame = document.createElement('div');
    frame.className = 'photo-preview-frame';
    const image = document.createElement('img');
    image.alt = 'Pré-visualização da fotografia';
    frame.append(image);

    const actions = document.createElement('div');
    actions.className = 'local-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancelar';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.textContent = 'Usar fotografia';
    apply.disabled = true;
    image.onload = () => { apply.disabled = false; };
    image.onerror = () => { frame.textContent = 'Não foi possível abrir a fotografia.'; };
    image.src = url;
    actions.append(cancel, apply);
    dialog.append(heading, frame, actions);

    cancel.onclick = () => dialog.close();
    apply.onclick = () => dialog.close('apply');
    dialog.addEventListener('close', () => {
      URL.revokeObjectURL(url);
      dialog.remove();
      resolve(dialog.returnValue === 'apply');
    }, {once:true});
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
