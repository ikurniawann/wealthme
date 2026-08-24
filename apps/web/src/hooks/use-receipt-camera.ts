"use client";

/**
 * EPIC-027 B1 (D8) — live `getUserMedia` preview for the receipt scanner,
 * deliberately NOT a native `<input capture>` (D8 rejected it).
 *
 * Extracted out of `components/shell/transaction-dialog.tsx` (a protected
 * foundation file) so the dialog only mounts and orchestrates. Every real
 * failure gets its own code so the UI can say what actually went wrong: a
 * denied permission must not look like a broken app.
 *
 * `getUserMedia` exists only in a secure context. `localhost` counts as
 * secure; a real device reached over plain HTTP does not, which is the
 * single most likely "the camera does nothing" report from the field —
 * hence its own `insecure-context` code instead of a generic failure.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraErrorCode =
  | "insecure-context"
  | "unsupported"
  | "permission-denied"
  | "not-found"
  | "in-use"
  | "unknown";

export type CameraStatus = "idle" | "starting" | "ready" | "error";

/**
 * Maps the DOMException names the spec defines for `getUserMedia`.
 * Exported for tests — the browser can throw these without any hardware.
 */
export function mapCameraError(err: unknown): CameraErrorCode {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: unknown }).name)
      : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "permission-denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "not-found";
    case "NotReadableError":
    case "AbortError":
      return "in-use";
    default:
      return "unknown";
  }
}

export type ReceiptCamera = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  errorCode: CameraErrorCode | null;
  start: () => Promise<void>;
  stop: () => void;
};

export function useReceiptCamera(): ReceiptCamera {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Kept in a ref as well as state: `stop` must always see the CURRENT
  // stream (unmount cleanup runs with whatever closure it captured, and a
  // leaked MediaStream leaves the device's camera light on).
  const streamRef = useRef<MediaStream | null>(null);
  // EPIC-027 group 7 review (CRITICAL) — cancellation guard. `start()` awaits
  // the browser's permission prompt, which the user can outlive: they cancel
  // the scan (or close the dialog) while it is pending, `stop()` runs and
  // finds `streamRef.current` still null so it stops nothing, and then the
  // promise resolves and hands us a LIVE stream. Without this counter
  // `start()` would then re-arm the camera after the user explicitly stopped
  // it — tracks nobody holds a reference to, and a device camera light that
  // never goes off — plus a state update on a possibly-unmounted hook.
  // Every `stop()` and the unmount cleanup bump the generation; a resolution
  // from a superseded generation stops its own tracks and touches no state.
  const generationRef = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorCode, setErrorCode] = useState<CameraErrorCode | null>(null);

  const stop = useCallback(() => {
    generationRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setErrorCode(null);
  }, []);

  const start = useCallback(async () => {
    generationRef.current += 1;
    const generation = generationRef.current;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setErrorCode(null);

    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setStatus("error");
      setErrorCode("insecure-context");
      return;
    }
    const media =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!media?.getUserMedia) {
      setStatus("error");
      setErrorCode("unsupported");
      return;
    }

    setStatus("starting");
    try {
      // `ideal`, not `exact`: a laptop with only a front camera still gets a
      // preview instead of an OverconstrainedError.
      const next = await media.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      if (generation !== generationRef.current) {
        // Superseded while the permission prompt was open: release the
        // stream we were just handed and leave every piece of state alone.
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = next;
      setStream(next);
      setStatus("ready");
    } catch (err) {
      if (generation !== generationRef.current) return;
      setStatus("error");
      setErrorCode(mapCameraError(err));
    }
  }, []);

  // The `<video>` element only exists once the scan view has rendered, so
  // the stream is attached here rather than inside `start`.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    // Autoplay can reject (a backgrounded tab); the preview simply stays
    // paused, which is not an error worth surfacing. `play()` is guarded
    // rather than awaited because jsdom's stub returns undefined, not a
    // promise.
    const played = video.play?.() as Promise<void> | undefined;
    if (played && typeof played.catch === "function") {
      played.catch(() => undefined);
    }
  }, [stream]);

  // Unmount cleanup — the dialog also calls `stop()` on close and when
  // leaving the scan view, but an unmount must never leak the stream.
  useEffect(() => {
    return () => {
      // Bumping the generation is what makes an in-flight `getUserMedia`
      // released rather than adopted by an unmounted hook.
      generationRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return { videoRef, status, errorCode, start, stop };
}
