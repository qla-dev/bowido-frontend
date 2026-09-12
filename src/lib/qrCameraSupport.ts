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
  pointsOfInterest?: { x: number; y: number }[];
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
      facingMode: { exact: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 16 / 9 },
    },
  },
  {
    audio: false,
    video: {
      facingMode: { exact: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  { audio: false, video: { facingMode: { exact: 'environment' } } },
];

// A scanner can be remounted while a previous getUserMedia request is still
// settling. Keep one app-wide lease so a later scanner can always release the
// earlier TrackPal stream before asking the browser for the camera again.
let activeQrCameraStream: MediaStream | null = null;

export const releaseActiveQrCameraStream = (): void => {
  activeQrCameraStream?.getTracks().forEach((track) => track.stop());
  activeQrCameraStream = null;
};

export const registerActiveQrCameraStream = (stream: MediaStream): void => {
  if (activeQrCameraStream && activeQrCameraStream !== stream) {
    releaseActiveQrCameraStream();
  }

  activeQrCameraStream = stream;
};

export const clearActiveQrCameraStream = (stream: MediaStream | null | undefined): void => {
  if (activeQrCameraStream === stream) {
    activeQrCameraStream = null;
  }
};

const getVideoTrack = (stream: MediaStream | null | undefined) =>
  stream?.getVideoTracks()[0] as ExtendedVideoTrack | undefined;

// applyConstraints replaces constraints. Serialize controls and merge at execution
// time so focus, torch and zoom cannot erase resolution or each other's settings.
const cameraUpdates = new WeakMap<MediaStreamTrack, Promise<void>>();
const updateCamera = (track: ExtendedVideoTrack, update: ExtendedConstraintSet): Promise<void> => {
  const operation = (cameraUpdates.get(track) ?? Promise.resolve()).then(async () => {
    if (track.readyState === 'ended') throw new Error('Camera stopped');
    const current = track.getConstraints?.() ?? {};
    const advanced = (current.advanced ?? []).map((item) => {
      const retained = { ...item };
      for (const key of Object.keys(update)) delete retained[key];
      return retained;
    }).filter((item) => Object.keys(item).length > 0);
    await track.applyConstraints({ ...current, advanced: [...advanced, update] });
  });
  cameraUpdates.set(track, operation.catch(() => undefined));
  return operation;
};

// Convert a tap on the square, object-cover preview to normalized video coordinates.
export const qrCameraFocusPoint = (
  x: number, y: number, width: number, height: number,
  videoWidth: number, videoHeight: number, displayZoom = 1,
) => {
  if (width <= 0 || height <= 0 || videoWidth <= 0 || videoHeight <= 0) return { x: 0.5, y: 0.5 };
  const scale = Math.max(width / videoWidth, height / videoHeight) * Math.max(1, displayZoom);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    x: clamp(0.5 + (x - width / 2) / (videoWidth * scale)),
    y: clamp(0.5 + (y - height / 2) / (videoHeight * scale)),
  };
};

export const refocusQrCamera = async (
  stream: MediaStream | null | undefined,
  point: { x: number; y: number },
): Promise<boolean> => {
  const track = getVideoTrack(stream);
  const modes = (track?.getCapabilities?.() as ExtendedCameraCapabilities | undefined)?.focusMode ?? [];
  if (!track || track.readyState === 'ended') return false;
  const mode = modes.includes('continuous') ? 'continuous' : modes.includes('single-shot') ? 'single-shot' : null;
  if (!mode) return false;
  const supported = navigator.mediaDevices?.getSupportedConstraints?.() as
    (MediaTrackSupportedConstraints & { pointsOfInterest?: boolean }) | undefined;
  try {
    // Keep point metering independent: drivers may reject it while supporting AF.
    if (supported?.pointsOfInterest) {
      await updateCamera(track, { pointsOfInterest: [point] }).catch(() => undefined);
    }
    if (mode === 'continuous' && modes.includes('single-shot')) {
      await updateCamera(track, { focusMode: 'single-shot' }).catch(() => undefined);
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    }
    await updateCamera(track, { focusMode: mode });
    const actual = track.getSettings?.() as (MediaTrackSettings & { focusMode?: string }) | undefined;
    return !actual?.focusMode || actual.focusMode === mode;
  } catch {
    return false;
  }
};

export const isQrCameraStreamLive = (stream: MediaStream | null | undefined): boolean =>
  Boolean(
    stream?.active &&
    stream.getVideoTracks().some((track) => track.readyState === 'live'),
  );

export const playQrCameraStream = async (
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> => {
  video.srcObject = stream;
  await video.play();

  if (!isQrCameraStreamLive(stream)) {
    throw new Error('The camera stream ended before video playback started.');
  }

  if (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => finish(false), 3000);
    const finish = (ready: boolean) => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('error', handleError);
      ready && isQrCameraStreamLive(stream) ? resolve() : reject(new Error('The camera did not produce a video frame.'));
    };
    const handleReady = () => finish(video.videoWidth > 0 && video.videoHeight > 0);
    const handleError = () => finish(false);

    video.addEventListener('loadeddata', handleReady, { once: true });
    video.addEventListener('canplay', handleReady, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
};

export const configureQrCamera = async (stream: MediaStream): Promise<QrCameraFeatures> => {
  const track = getVideoTrack(stream);

  if (!track) {
    return { torchSupported: false };
  }

  const capabilities = track.getCapabilities?.() as ExtendedCameraCapabilities | undefined;
  const preferredSettings: ExtendedConstraintSet = {};

  if (capabilities?.focusMode?.includes('continuous')) {
    preferredSettings.focusMode = 'continuous';
  } else if (capabilities?.focusMode?.includes('single-shot')) {
    preferredSettings.focusMode = 'single-shot';
  }

  if (capabilities?.exposureMode?.includes('continuous')) {
    preferredSettings.exposureMode = 'continuous';
  }

  if (capabilities?.whiteBalanceMode?.includes('continuous')) {
    preferredSettings.whiteBalanceMode = 'continuous';
  }

  if (Object.keys(preferredSettings).length > 0) {
    // A rejected exposure/white-balance preference must not prevent autofocus.
    for (const [key, value] of Object.entries(preferredSettings)) {
      await updateCamera(track, { [key]: value }).catch(() => undefined);
    }
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
    await updateCamera(track, { torch: enabled });
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
    await updateCamera(track, { zoom });
    return true;
  } catch {
    return false;
  }
};

/**
 * Camera drivers usually process `applyConstraints` calls serially. A range
 * input can produce dozens of values per second, so issuing every value makes
 * the preview catch up long after the user's finger has stopped. Keep just the
 * newest requested value while a camera update is in flight instead.
 */
export const createQrCameraZoomController = (
  applyZoom: typeof setQrCameraZoom = setQrCameraZoom,
) => {
  let pending: { stream: MediaStream | null | undefined; zoom: number } | null = null;
  let isApplying = false;

  const flush = async () => {
    if (isApplying) {
      return;
    }

    isApplying = true;
    while (pending) {
      const next = pending;
      pending = null;
      await applyZoom(next.stream, next.zoom);
    }
    isApplying = false;
  };

  return {
    request: (stream: MediaStream | null | undefined, zoom: number) => {
      pending = { stream, zoom };
      void flush();
    },
    clear: () => {
      pending = null;
    },
  };
};
