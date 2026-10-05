'use client';

import { BrowserQRCodeReader } from '@zxing/browser';

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue?: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

/** Every startup owns its stream and decoding video, even when it resolves after cancellation. */
export async function startQrScanner(preview: HTMLVideoElement, signal: AbortSignal, onCode: (text: string) => void) {
  let stream: MediaStream | undefined;
  let controls: { stop(): void } | undefined;
  let frame: number | undefined;
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true;
  const stop = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    try { controls?.stop(); } catch { /* A stopped decoder must not prevent stream cleanup. */ }
    stream?.getTracks().forEach(track => track.stop());
    if (stream && preview.srcObject === stream) preview.srcObject = null;
    video.srcObject = null;
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    if (signal.aborted) return;
    stream = await navigator.mediaDevices.getUserMedia({ audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (signal.aborted) { stop(); return; }
    preview.srcObject = stream;
    await preview.play();
    if (signal.aborted) { stop(); return; }
    const NativeDetector = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (NativeDetector) {
      video.srcObject = stream;
      await video.play();
      if (signal.aborted) { stop(); return; }
      const detector = new NativeDetector({ formats: ['qr_code'] });
      const scan = async () => {
        if (signal.aborted) return;
        try {
          const results = await detector.detect(video);
          if (!signal.aborted && results[0]?.rawValue) onCode(results[0].rawValue);
        } catch { /* An undecodable frame should not stop the camera. */ }
        finally { if (!signal.aborted) frame = requestAnimationFrame(scan); }
      };
      frame = requestAnimationFrame(scan);
    } else {
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 40, delayBetweenScanSuccess: 100, tryPlayVideoTimeout: 1500 });
      controls = await reader.decodeFromStream(stream, video, result => {
        if (!signal.aborted && result) onCode(result.getText());
      });
      if (signal.aborted) stop();
    }
  } catch (error) {
    stop();
    signal.removeEventListener('abort', stop);
    if (!signal.aborted) throw error;
  }
}
