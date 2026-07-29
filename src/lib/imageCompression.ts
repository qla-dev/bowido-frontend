import imageCompression from 'browser-image-compression';

const TARGET_SIZE_MB = 0.12;

/**
 * Shared client-side compression for every photo that TrackPal uploads.
 * A 1200px longest edge fits inside the 1600 × 1200 server limit, preserves
 * the aspect ratio, and does not enlarge smaller photos.
 */
export async function compressPhotoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: TARGET_SIZE_MB,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
    preserveExif: false,
  });

  const name = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.webp`;

  return new File([compressed], name, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}
