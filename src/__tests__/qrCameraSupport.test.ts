import { describe, expect, it, vi } from 'vitest';
import {
  configureQrCamera,
  createQrCameraZoomController,
  isQrCameraStreamLive,
  qrCameraConstraintAttempts,
  setQrCameraTorch,
  setQrCameraZoom,
  refocusQrCamera,
  qrCameraFocusPoint,
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

    expect(firstVideoConstraints.facingMode).toEqual({ exact: 'environment' });
    expect(firstVideoConstraints.width).toEqual({ ideal: 1920 });
    expect(firstVideoConstraints.height).toEqual({ ideal: 1080 });
    for (const attempt of qrCameraConstraintAttempts) {
      expect((attempt.video as MediaTrackConstraints).facingMode).toEqual({ exact: 'environment' });
    }
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
      advanced: [{ focusMode: 'continuous' }],
    });

    await expect(setQrCameraTorch(stream, true)).resolves.toBe(true);
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });

    await expect(setQrCameraZoom(stream, 3)).resolves.toBe(true);
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 3 }] });
  });

  it('preserves resolution and focus across concurrent torch and zoom updates', async () => {
    let constraints: MediaTrackConstraints = {
      width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: { exact: 'environment' },
    };
    const track = {
      getConstraints: () => constraints,
      getCapabilities: () => ({ focusMode: ['continuous'], torch: true, zoom: { min: 1, max: 4 } }),
      applyConstraints: vi.fn(async (next) => { constraints = next; }),
    };
    const stream = { getVideoTracks: () => [track] } as unknown as MediaStream;
    await configureQrCamera(stream);
    await Promise.all([setQrCameraTorch(stream, true), setQrCameraZoom(stream, 2)]);
    await setQrCameraZoom(stream, 3);
    expect(constraints).toEqual({
      width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: { exact: 'environment' },
      advanced: [{ focusMode: 'continuous' }, { torch: true }, { zoom: 3 }],
    });
  });

  it('keeps configuring the camera if an optional mode fails', async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined).mockRejectedValueOnce(new Error('Driver rejected focus'));
    const stream = { getVideoTracks: () => [{
      getCapabilities: () => ({ focusMode: ['continuous'], exposureMode: ['continuous'] }),
      applyConstraints,
    }] } as unknown as MediaStream;
    await expect(configureQrCamera(stream)).resolves.toEqual({ torchSupported: false });
    expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ exposureMode: 'continuous' }] });
  });

  it('maps taps through the preview crop and display zoom', () => {
    expect(qrCameraFocusPoint(0, 120, 240, 240, 1920, 1080).x).toBeCloseTo(0.21875);
    expect(qrCameraFocusPoint(120, 0, 240, 240, 1080, 1920).y).toBeCloseTo(0.21875);
    expect(qrCameraFocusPoint(0, 120, 240, 240, 1920, 1080, 2).x).toBeCloseTo(0.359375);
    expect(qrCameraFocusPoint(120, 120, 240, 240, 1920, 1080)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('requests a focus cycle and restores continuous autofocus', async () => {
    vi.useFakeTimers();
    try {
      const applyConstraints = vi.fn().mockResolvedValue(undefined);
      const stream = { getVideoTracks: () => [{
        getCapabilities: () => ({ focusMode: ['continuous', 'single-shot'] }),
        applyConstraints,
      }] } as unknown as MediaStream;
      const pending = refocusQrCamera(stream, { x: 0.5, y: 0.5 });
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toBe(true);
      expect(applyConstraints).toHaveBeenNthCalledWith(1, { advanced: [{ focusMode: 'single-shot' }] });
      expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ focusMode: 'continuous' }] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not pretend fixed-focus cameras support refocusing', async () => {
    const applyConstraints = vi.fn();
    const stream = { getVideoTracks: () => [{ getCapabilities: () => ({ focusMode: ['manual'] }), applyConstraints }] } as unknown as MediaStream;
    await expect(refocusQrCamera(stream, { x: 0.5, y: 0.5 })).resolves.toBe(false);
    expect(applyConstraints).not.toHaveBeenCalled();
  });

  it('still requests autofocus if the driver rejects the tapped point', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getSupportedConstraints: () => ({ pointsOfInterest: true }) } });
    try {
      const applyConstraints = vi.fn().mockRejectedValueOnce(new Error('Point not supported')).mockResolvedValue(undefined);
      const stream = { getVideoTracks: () => [{
        getCapabilities: () => ({ focusMode: ['continuous'] }), applyConstraints,
      }] } as unknown as MediaStream;
      await expect(refocusQrCamera(stream, { x: 0.25, y: 0.75 })).resolves.toBe(true);
      expect(applyConstraints).toHaveBeenNthCalledWith(1, { advanced: [{ pointsOfInterest: [{ x: 0.25, y: 0.75 }] }] });
      expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ focusMode: 'continuous' }] });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not restore focus onto a stopped camera after the focus delay', async () => {
    vi.useFakeTimers();
    try {
      const track = {
        readyState: 'live',
        getCapabilities: () => ({ focusMode: ['continuous', 'single-shot'] }),
        applyConstraints: vi.fn().mockResolvedValue(undefined),
      };
      const stream = { getVideoTracks: () => [track] } as unknown as MediaStream;
      const pending = refocusQrCamera(stream, { x: 0.5, y: 0.5 });
      await vi.advanceTimersByTimeAsync(100);
      track.readyState = 'ended';
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toBe(false);
      expect(track.applyConstraints).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('coalesces rapid zoom changes so the camera only catches up to the latest value', async () => {
    let resolveFirstUpdate: (() => void) | undefined;
    const applyZoom = vi.fn()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
        resolveFirstUpdate = () => resolve(true);
      }))
      .mockResolvedValue(true);
    const controller = createQrCameraZoomController(applyZoom);
    const stream = {} as MediaStream;

    controller.request(stream, 1.1);
    controller.request(stream, 1.5);
    controller.request(stream, 2.4);
    expect(applyZoom).toHaveBeenCalledTimes(1);
    expect(applyZoom).toHaveBeenLastCalledWith(stream, 1.1);

    resolveFirstUpdate?.();
    await vi.waitFor(() => {
      expect(applyZoom).toHaveBeenCalledTimes(2);
      expect(applyZoom).toHaveBeenLastCalledWith(stream, 2.4);
    });
  });
});
