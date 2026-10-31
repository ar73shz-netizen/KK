// اسکنر بارکد: اول BarcodeDetector خود مرورگر، اگر نبود ZXing (داخل WebView اندروید معمولاً این یکی)
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

const NATIVE_FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix'];
const ZX_FORMATS = [
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
];
const CONSTRAINTS = { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };

function stopStream(stream, video) {
  try { stream?.getTracks().forEach((t) => t.stop()); } catch { /* */ }
  try { if (video) video.srcObject = null; } catch { /* */ }
}

// ویدیو را راه می‌اندازد و برای هر بارکد خوانده‌شده onCode(متن) را صدا می‌زند. تابع توقف را برمی‌گرداند.
export async function startScanner(video, onCode) {
  if (!navigator.mediaDevices?.getUserMedia) { const e = new Error('no camera api'); e.name = 'NotSupportedError'; throw e; }

  if ('BarcodeDetector' in window) {
    let stream = null;
    try {
      let formats = NATIVE_FORMATS;
      if (window.BarcodeDetector.getSupportedFormats) {
        const sup = await window.BarcodeDetector.getSupportedFormats();
        formats = NATIVE_FORMATS.filter((f) => sup.includes(f));
      }
      if (formats.length) {
        const det = new window.BarcodeDetector({ formats });
        stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
        video.srcObject = stream;
        video.muted = true; video.setAttribute('playsinline', '');
        await video.play();
        let alive = true, busy = false;
        const tick = async () => {
          if (!alive) return;
          if (!busy && video.readyState >= 2) {
            busy = true;
            try { (await det.detect(video)).forEach((r) => r.rawValue && onCode(r.rawValue)); } catch { /* فریم بعدی */ }
            busy = false;
          }
          if (alive) setTimeout(tick, 140);
        };
        tick();
        return () => { alive = false; stopStream(stream, video); };
      }
    } catch (e) {
      stopStream(stream, video);
      // اگر مشکل از دسترسی دوربین است همین را گزارش بده؛ در غیر این صورت با ZXing ادامه بده
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError' || e?.name === 'NotFoundError') throw e;
    }
  }

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, ZX_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
  video.muted = true; video.setAttribute('playsinline', '');
  const controls = await reader.decodeFromConstraints(CONSTRAINTS, video, (result) => {
    if (result) onCode(result.getText());
  });
  return () => { try { controls.stop(); } catch { /* */ } };
}
