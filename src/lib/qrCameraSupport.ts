export type CameraZoomRange = {
  min: number;
  max: number;
  step: number;
  current: number;
};

export type QrCameraFeatures = {
  torchSupported: boolean;
  zoomRange?: CameraZoomRange;
};

type ExtendedCameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
  zoom?: { min?: number; max?: number; step?: number };
};

type ExtendedCameraSettings = MediaTrackSettings & { zoom?: number };

type ExtendedConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean;
  focusMode?: string;
  exposureMode?: string;
  whiteBalanceMode?: string;
  zoom?: number;
};

type ExtendedVideoTrack = MediaStreamTrack & {
  applyConstraints: (
    constraints: MediaTrackConstraints & { advanced?: ExtendedConstraintSet[] },
  ) => Promise<void>;
};

export const qrCameraConstraintAttempts: MediaStreamConstraints[] = [
  {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 16 / 9 },
    },
  },
  {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  { audio: false, video: { facingMode: 'environment' } },
  { audio: false, video: true },
];

const getVideoTrack = (stream: MediaStream | null | undefined) =>
  stream?.getVideoTracks()[0] as ExtendedVideoTrack | undefined;

export const configureQrCamera = async (stream: MediaStream): Promise<QrCameraFeatures> => {
  const track = getVideoTrack(stream);

  if (!track) {
    return { torchSupported: false };
  }

  const capabilities = track.getCapabilities?.() as ExtendedCameraCapabilities | undefined;
  const preferredSettings: ExtendedConstraintSet = {};

  if (capabilities?.focusMode?.includes('continuous')) {
    preferredSettings.focusMode = 'continuous';
  }

  if (capabilities?.exposureMode?.includes('continuous')) {
    preferredSettings.exposureMode = 'continuous';
  }

  if (capabilities?.whiteBalanceMode?.includes('continuous')) {
    preferredSettings.whiteBalanceMode = 'continuous';
  }

  if (Object.keys(preferredSettings).length > 0) {
    await track.applyConstraints({ advanced: [preferredSettings] }).catch(() => undefined);
  }

  const zoom = capabilities?.zoom;
  const currentZoom = (track.getSettings?.() as ExtendedCameraSettings | undefined)?.zoom;
  const zoomRange =
    zoom &&
    typeof zoom.min === 'number' &&
    typeof zoom.max === 'number' &&
    zoom.max > zoom.min
      ? {
          min: zoom.min,
          max: zoom.max,
          step: zoom.step || 0.1,
          current: Math.min(zoom.max, Math.max(zoom.min, currentZoom ?? zoom.min)),
        }
      : undefined;

  return {
    torchSupported: capabilities?.torch === true,
    zoomRange,
  };
};

export const setQrCameraTorch = async (
  stream: MediaStream | null | undefined,
  enabled: boolean,
): Promise<boolean> => {
  const track = getVideoTrack(stream);
  const capabilities = track?.getCapabilities?.() as ExtendedCameraCapabilities | undefined;

  if (!track || capabilities?.torch !== true) {
    return false;
  }

  try {
    await track.applyConstraints({ advanced: [{ torch: enabled }] });
    return true;
  } catch {
    return false;
  }
};

export const setQrCameraZoom = async (
  stream: MediaStream | null | undefined,
  zoom: number,
): Promise<boolean> => {
  const track = getVideoTrack(stream);
  const capabilities = track?.getCapabilities?.() as ExtendedCameraCapabilities | undefined;

  if (!track || !capabilities?.zoom) {
    return false;
  }

  try {
    await track.applyConstraints({ advanced: [{ zoom }] });
    return true;
  } catch {
    return false;
  }
};
