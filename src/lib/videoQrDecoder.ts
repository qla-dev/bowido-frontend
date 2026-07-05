import jsQR from 'jsqr';

type CanvasRef = {
  current: HTMLCanvasElement | null;
};

export const decodeQrFromVideo = (
  video: HTMLVideoElement,
  canvasRef: CanvasRef
): string | null => {
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const canvas = canvasRef.current ?? document.createElement('canvas');
  canvasRef.current = canvas;

  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(video, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  return decoded?.data?.trim() || null;
};

export const decodeQrFromImageBitmap = (
  bitmap: ImageBitmap,
  canvasRef: CanvasRef
): string | null => {
  const canvas = canvasRef.current ?? document.createElement('canvas');
  canvasRef.current = canvas;

  if (canvas.width !== bitmap.width) {
    canvas.width = bitmap.width;
  }

  if (canvas.height !== bitmap.height) {
    canvas.height = bitmap.height;
  }

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  return decoded?.data?.trim() || null;
};
