import jsQR from 'jsqr';

type CanvasRef = {
  current: HTMLCanvasElement | null;
};

type VideoQrDecodeOptions = {
  /**
   * Keep the whole camera frame, but cap its largest side before handing it to
   * jsQR. This preserves off-centre codes while substantially reducing pixel
   * processing on the common scan pass.
   */
  maxDimension?: number;
  inversionAttempts?: 'dontInvert' | 'attemptBoth';
};

export const decodeQrFromVideo = (
  video: HTMLVideoElement,
  canvasRef: CanvasRef,
  options: VideoQrDecodeOptions = {}
): string | null => {
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const canvas = canvasRef.current ?? document.createElement('canvas');
  canvasRef.current = canvas;

  const largestSide = Math.max(width, height);
  const scale = options.maxDimension && largestSide > options.maxDimension
    ? options.maxDimension / largestSide
    : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  if (canvas.width !== targetWidth) {
    canvas.width = targetWidth;
  }

  if (canvas.height !== targetHeight) {
    canvas.height = targetHeight;
  }

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(video, 0, 0, width, height, 0, 0, targetWidth, targetHeight);
  const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: options.inversionAttempts ?? 'dontInvert',
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
