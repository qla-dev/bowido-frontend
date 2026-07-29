export interface NativeQrDetector {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

interface NativeQrDetectorConstructor {
  new (options?: { formats?: string[] }): NativeQrDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

/**
 * The browser-standard API retains its BarcodeDetector name, but this adapter
 * exposes only TrackPal's QR-only capability to the application.
 */
export const createNativeQrDetector = async (): Promise<NativeQrDetector | null> => {
  const detectorApi = (
    window as Window & {
      BarcodeDetector?: NativeQrDetectorConstructor;
    }
  ).BarcodeDetector;

  if (!detectorApi) {
    return null;
  }

  try {
    if (detectorApi.getSupportedFormats) {
      const supportedFormats = await detectorApi.getSupportedFormats().catch(() => []);

      if (supportedFormats.length > 0 && !supportedFormats.includes('qr_code')) {
        return null;
      }
    }

    return new detectorApi({ formats: ['qr_code'] });
  } catch {
    return null;
  }
};
