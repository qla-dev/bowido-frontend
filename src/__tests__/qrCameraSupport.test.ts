import { describe, expect, it, vi } from 'vitest';
import {
  configureQrCamera,
  isQrCameraStreamLive,
  qrCameraConstraintAttempts,
  setQrCameraTorch,
  setQrCameraZoom,
} from '../lib/qrCameraSupport';

describe('QR camera support', () => {
  it('recognizes whether a camera stream can still provide frames', () => {
    const liveStream = {
      active: true,
      getVideoTracks: () => [{ readyState: 'live' }],
    } as unknown as MediaStream;
    const endedStream = {
      active: true,
      getVideoTracks: () => [{ readyState: 'ended' }],
    } as unknown as MediaStream;

    expect(isQrCameraStreamLive(liveStream)).toBe(true);
    expect(isQrCameraStreamLive(endedStream)).toBe(false);
    expect(isQrCameraStreamLive(null)).toBe(false);
  });

  it('prefers a high-resolution rear camera before compatibility fallbacks', () => {
    const firstVideoConstraints = qrCameraConstraintAttempts[0].video as MediaTrackConstraints;

    expect(firstVideoConstraints.facingMode).toEqual({ ideal: 'environment' });
    expect(firstVideoConstraints.width).toEqual({ ideal: 1920 });
    expect(firstVideoConstraints.height).toEqual({ ideal: 1080 });
    expect(qrCameraConstraintAttempts.at(-1)?.video).toBe(true);
  });

  it('enables supported continuous camera modes and exposes torch and zoom', async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const track = {
      getCapabilities: () => ({
        torch: true,
        focusMode: ['manual', 'continuous'],
        exposureMode: ['continuous'],
        whiteBalanceMode: ['continuous'],
        zoom: { min: 1, max: 4, step: 0.25 },
      }),
      getSettings: () => ({ zoom: 2 }),
      applyConstraints,
    };
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(configureQrCamera(stream)).resolves.toEqual({
      torchSupported: true,
      zoomRange: { min: 1, max: 4, step: 0.25, current: 2 },
    });
    expect(applyConstraints).toHaveBeenCalledWith({
      advanced: [{
        focusMode: 'continuous',
        exposureMode: 'continuous',
        whiteBalanceMode: 'continuous',
      }],
    });

    await expect(setQrCameraTorch(stream, true)).resolves.toBe(true);
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });

    await expect(setQrCameraZoom(stream, 3)).resolves.toBe(true);
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 3 }] });
  });
});
