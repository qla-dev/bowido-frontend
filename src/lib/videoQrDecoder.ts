import jsQR from 'jsqr';

type CanvasRef = {
  current: HTMLCanvasElement | null;
};

type VideoQrDecodeOptions = {
  maxDimension?: number;
  inversionAttempts?: 'dontInvert' | 'attemptBoth';
  multiPass?: boolean;
  enhanceContrast?: boolean;
};

type DecodePass = {
  cropScale: number;
  enhanced: boolean;
};

const enhanceForDifficultLighting = (imageData: ImageData) => {
  const pixels = imageData.data;
  let luminanceTotal = 0;
  let sampleCount = 0;

  for (let index = 0; index < pixels.length; index += 16) {
    luminanceTotal += pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    sampleCount += 1;
  }

  const averageLuminance = sampleCount > 0 ? luminanceTotal / sampleCount : 128;
  const brightnessLift = Math.max(0, Math.min(54, 118 - averageLuminance));
  const contrast = averageLuminance < 90 ? 1.75 : 1.5;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    const adjusted = Math.max(0, Math.min(255, (luminance - averageLuminance) * contrast + averageLuminance + brightnessLift));
    pixels[index] = adjusted;
    pixels[index + 1] = adjusted;
    pixels[index + 2] = adjusted;
  }

  return imageData;
};

const decodeSource = (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  canvasRef: CanvasRef,
  options: VideoQrDecodeOptions,
) => {
  const canvas = canvasRef.current ?? document.createElement('canvas');
  canvasRef.current = canvas;
  const largestSide = Math.max(sourceWidth, sourceHeight);
  const outputScale = options.maxDimension && largestSide > options.maxDimension
    ? options.maxDimension / largestSide
    : 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * outputScale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * outputScale));
  const passes: DecodePass[] = [
    { cropScale: 1, enhanced: false },
    ...(options.multiPass
      ? [
          { cropScale: 0.72, enhanced: false },
          { cropScale: 0.5, enhanced: false },
        ]
      : []),
    ...(options.enhanceContrast
      ? [
          { cropScale: 1, enhanced: true },
          { cropScale: 0.72, enhanced: true },
          { cropScale: 0.5, enhanced: true },
        ]
      : []),
  ];

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

  for (const pass of passes) {
    const cropWidth = Math.max(1, Math.round(sourceWidth * pass.cropScale));
    const cropHeight = Math.max(1, Math.round(sourceHeight * pass.cropScale));
    const sourceX = Math.round((sourceWidth - cropWidth) / 2);
    const sourceY = Math.round((sourceHeight - cropHeight) / 2);

    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(
      source,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
    const decoded = jsQR(
      pass.enhanced ? enhanceForDifficultLighting(imageData).data : imageData.data,
      imageData.width,
      imageData.height,
      { inversionAttempts: options.inversionAttempts ?? 'dontInvert' },
    );

    if (decoded?.data?.trim()) {
      return decoded.data.trim();
    }
  }

  return null;
};

export const decodeQrFromVideo = (
  video: HTMLVideoElement,
  canvasRef: CanvasRef,
  options: VideoQrDecodeOptions = {},
): string | null => {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  return decodeSource(video, video.videoWidth, video.videoHeight, canvasRef, options);
};

export const decodeQrFromImageBitmap = (
  bitmap: ImageBitmap,
  canvasRef: CanvasRef,
): string | null => decodeSource(bitmap, bitmap.width, bitmap.height, canvasRef, {
  maxDimension: 1600,
  inversionAttempts: 'attemptBoth',
  multiPass: true,
  enhanceContrast: true,
});
