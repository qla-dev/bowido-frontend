import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const frontendRoot = path.resolve(dirname, '..');
const trackpalRoot = path.resolve(frontendRoot, '..');
const trendyRoot = process.env.TRENDY_PROJECT_ROOT
  ? path.resolve(process.env.TRENDY_PROJECT_ROOT)
  : path.resolve(trackpalRoot, '..', 'trendy');

const args = process.argv.slice(2);
const failOnFindings = args.includes('--fail-on-findings');
const palletTotalsArg = args.find((arg) => arg.startsWith('--pallets='));
const samplePalletTotals = palletTotalsArg
  ? palletTotalsArg
      .slice('--pallets='.length)
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0)
  : [25, 100, 250, 1000];

const readText = (filePath, required = true) => {
  if (!fs.existsSync(filePath)) {
    if (required) {
      throw new Error(`Missing required source file: ${filePath}`);
    }

    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
};

const normalizePath = (filePath) => filePath.replace(/\\/g, '/');

const projectRelative = (filePath) => {
  const relativeToTrackpal = path.relative(trackpalRoot, filePath);

  if (!relativeToTrackpal.startsWith('..')) {
    return normalizePath(relativeToTrackpal);
  }

  return normalizePath(filePath);
};

const lineOf = (source, needle) => {
  const index = typeof needle === 'string' ? source.indexOf(needle) : source.search(needle);

  if (index < 0) {
    return null;
  }

  return source.slice(0, index).split(/\r?\n/).length;
};

const loc = (filePath, line) => `${projectRelative(filePath)}${line ? `:${line}` : ''}`;

const results = [];

const addResult = (status, category, title, details = []) => {
  results.push({
    status,
    category,
    title,
    details: details.filter(Boolean),
  });
};

const ok = (category, title, details = []) => addResult('ok', category, title, details);
const info = (category, title, details = []) => addResult('info', category, title, details);
const finding = (category, title, details = []) => addResult('finding', category, title, details);

const apiPath = path.join(frontendRoot, 'src', 'services', 'api.ts');
const appContextPath = path.join(frontendRoot, 'src', 'AppContext.tsx');
const scannerPath = path.join(frontendRoot, 'src', 'components', 'PalletScanner.tsx');
const decoderPath = path.join(frontendRoot, 'src', 'lib', 'videoQrDecoder.ts');
const qrCodePath = path.join(frontendRoot, 'src', 'lib', 'qrCode.ts');
const palletQrCodePath = path.join(frontendRoot, 'src', 'components', 'PalletQrCode.tsx');
const trendyMaterialPath = path.join(
  trendyRoot,
  'resources',
  'js',
  'scripts',
  'pages',
  'app-material.js'
);
const trendyScannerPath = path.join(
  trendyRoot,
  'resources',
  'views',
  'content',
  'new-components',
  'nalog-scan.blade.php'
);

const apiSource = readText(apiPath);
const appContextSource = readText(appContextPath);
const scannerSource = readText(scannerPath);
const decoderSource = readText(decoderPath);
const qrCodeSource = readText(qrCodePath);
const palletQrCodeSource = readText(palletQrCodePath);
const trendyMaterialSource = readText(trendyMaterialPath, false);
const trendyScannerSource = readText(trendyScannerPath, false);

const listAllPageSize = apiSource.includes('Math.min(requestedLimit, 100)') ? 100 : 25;
const trackpalPalletsListAll = apiSource.includes(
  "list: async (): Promise<Pallet[]> => (await listAll<ApiRecord>('/pallets')).map(normalizePallet)"
);
const trackpalInitialPalletLoad = appContextSource.includes(
  'safeLoad(() => apiService.pallets.list(), [])'
);

if (trackpalPalletsListAll && trackpalInitialPalletLoad) {
  const pageEstimate = samplePalletTotals
    .map((total) => `${total} pallets -> ${Math.ceil(total / listAllPageSize)} request(s)`)
    .join(', ');

  finding('Load', 'Trackpal drains every pallet page during initial app refresh.', [
    `${loc(appContextPath, lineOf(appContextSource, 'safeLoad(() => apiService.pallets.list(), [])'))} calls apiService.pallets.list() in refreshData().`,
    `${loc(apiPath, lineOf(apiSource, "list: async (): Promise<Pallet[]> => (await listAll<ApiRecord>('/pallets')).map(normalizePallet)"))} maps pallets through listAll('/pallets').`,
    `${loc(apiPath, lineOf(apiSource, 'Math.min(requestedLimit, 100)'))} caps each fetched page at ${listAllPageSize} records.`,
    `Estimated /api/pallets traffic: ${pageEstimate}.`,
  ]);
} else {
  ok('Load', 'Trackpal pallet loading does not appear to drain every page at startup.');
}

if (/serverSide:\s*true/.test(trendyMaterialSource) && /pageLength:\s*25/.test(trendyMaterialSource)) {
  ok('Load', 'Trendy material list uses server-side paging for the first screen.', [
    `${loc(trendyMaterialPath, lineOf(trendyMaterialSource, 'serverSide: true'))} enables DataTables serverSide mode.`,
    `${loc(trendyMaterialPath, lineOf(trendyMaterialSource, 'pageLength: 25'))} requests 25 rows for the first page.`,
  ]);
} else if (trendyMaterialSource) {
  finding('Load', 'Could not confirm Trendy server-side paging from the local material screen.');
} else {
  info('Load', 'Trendy material screen was not found; set TRENDY_PROJECT_ROOT to compare another checkout.');
}

const videoIndex = scannerSource.indexOf('<video');
const videoCloseIndex = videoIndex >= 0 ? scannerSource.indexOf('/>', videoIndex) : -1;
const videoTag = videoIndex >= 0 && videoCloseIndex > videoIndex
  ? scannerSource.slice(videoIndex, videoCloseIndex + 2)
  : '';
const decorativeLayerIndex = scannerSource.indexOf('bg-[radial-gradient', videoIndex);
const decorativeLayerSlice = decorativeLayerIndex >= 0
  ? scannerSource.slice(decorativeLayerIndex, decorativeLayerIndex + 1500)
  : '';

if (
  videoIndex >= 0 &&
  decorativeLayerIndex > videoIndex &&
  decorativeLayerSlice.includes('#07110d')
) {
  finding('QR Scan', 'Trackpal paints a full-cover dark scanner graphic after the video element.', [
    `${loc(scannerPath, lineOf(scannerSource, '<video'))} renders the camera feed first.`,
    `${loc(scannerPath, lineOf(scannerSource, 'bg-[radial-gradient'))} renders a later absolute overlay with a solid #07110d background.`,
    'That makes aiming harder because the visible frame is not the real camera frame the decoder sees.',
  ]);
} else {
  ok('QR Scan', 'Trackpal camera feed is not obviously covered by a later solid overlay.');
}

const zoomTransformOnOverlay = scannerSource.includes('style={{ transform: `scale(${cameraZoom})` }}');
const videoUsesCameraZoom = videoTag.includes('cameraZoom');

if (zoomTransformOnOverlay && !videoUsesCameraZoom) {
  finding('QR Scan', 'Trackpal zoom changes the decorative layer, not the camera/decode frame.', [
    `${loc(scannerPath, lineOf(scannerSource, 'style={{ transform: `scale(${cameraZoom})` }}'))} applies cameraZoom outside the video tag.`,
    `${loc(scannerPath, lineOf(scannerSource, '<video'))} video tag has no cameraZoom transform.`,
  ]);
} else if (zoomTransformOnOverlay) {
  ok('QR Scan', 'Trackpal zoom appears to affect the video element.');
} else {
  info('QR Scan', 'No Trackpal cameraZoom transform was found.');
}

if (
  decoderSource.includes('drawImage(video, 0, 0, width, height)') &&
  decoderSource.includes('getImageData(0, 0, width, height)')
) {
  finding('QR Scan', 'Trackpal jsQR fallback decodes the full camera frame every scan.', [
    `${loc(decoderPath, lineOf(decoderSource, 'drawImage(video, 0, 0, width, height)'))} draws the entire video frame.`,
    `${loc(decoderPath, lineOf(decoderSource, 'getImageData(0, 0, width, height)'))} reads the entire frame into jsQR.`,
    'Large frames are slower and give the scanner more irrelevant image data than a qrbox crop.',
  ]);
} else {
  ok('QR Scan', 'Trackpal fallback decoder appears to crop before decoding.');
}

if (decoderSource.includes("inversionAttempts: 'attemptBoth'")) {
  finding('QR Scan', 'Trackpal jsQR fallback tries both normal and inverted scans.', [
    `${loc(decoderPath, lineOf(decoderSource, "inversionAttempts: 'attemptBoth'"))} doubles useful fallback work for ordinary black-on-white QR labels.`,
  ]);
}

if (scannerSource.includes('BarcodeDetector')) {
  ok('QR Scan', 'Trackpal tries the native BarcodeDetector before falling back to jsQR.', [
    `${loc(scannerPath, lineOf(scannerSource, 'BarcodeDetector'))} defines the native detector path.`,
  ]);
}

if (!scannerSource.includes('Html5Qrcode')) {
  finding('QR Scan', 'Trackpal does not use the scanner library Trendy uses.', [
    'Trendy uses html5-qrcode with qrbox/fps configuration and camera retries.',
  ]);
}

const trackpalHasCameraSelect = scannerSource.includes('cameraSelect') || scannerSource.includes('<select');
const trendyHasCameraSelect = trendyScannerSource.includes('cameraSelect');
const trendyHasRestart = trendyScannerSource.includes('restartScanner');

if (!trackpalHasCameraSelect && (trendyHasCameraSelect || trendyHasRestart)) {
  finding('QR Scan', 'Trackpal lacks Trendy-style camera selection and restart controls.', [
    trendyHasCameraSelect
      ? `${loc(trendyScannerPath, lineOf(trendyScannerSource, 'cameraSelect'))} keeps a camera selector.`
      : '',
    trendyHasRestart
      ? `${loc(trendyScannerPath, lineOf(trendyScannerSource, 'restartScanner'))} has a scanner restart path.`
      : '',
  ]);
}

if (
  trendyScannerSource.includes('new Html5Qrcode') &&
  /fps:\s*10/.test(trendyScannerSource) &&
  /qrbox:\s*function/.test(trendyScannerSource) &&
  /aspectRatio:\s*1/.test(trendyScannerSource)
) {
  ok('QR Scan', 'Trendy scanner constrains decode work with html5-qrcode settings.', [
    `${loc(trendyScannerPath, lineOf(trendyScannerSource, 'fps: 10'))} sets a fixed scan rate.`,
    `${loc(trendyScannerPath, lineOf(trendyScannerSource, 'qrbox: function'))} crops scanning to a centered QR box.`,
    `${loc(trendyScannerPath, lineOf(trendyScannerSource, 'aspectRatio: 1'))} keeps the scanner square.`,
  ]);
}

if (qrCodeSource.includes('LOW_ERROR_CORRECTION_FORMAT_BITS') && qrCodeSource.includes('QR_VERSIONS')) {
  info('QR Print', 'Trackpal uses a custom built-in QR matrix renderer.', [
    `${loc(qrCodePath, lineOf(qrCodeSource, 'LOW_ERROR_CORRECTION_FORMAT_BITS'))} uses low error correction format bits.`,
    `${loc(qrCodePath, lineOf(qrCodeSource, 'QR_VERSIONS'))} supports versions 1 through 5.`,
    `${loc(palletQrCodePath, lineOf(palletQrCodeSource, 'const quietZone = 4'))} renders a 4-module quiet zone.`,
  ]);
}

if (trendyMaterialSource.includes('api.qrserver.com') && trendyMaterialSource.includes('qrSvgMarkupCache')) {
  info('QR Print', 'Trendy material QR labels fetch and cache 360px SVG QR markup.', [
    `${loc(trendyMaterialPath, lineOf(trendyMaterialSource, 'api.qrserver.com'))} builds the QR service URL.`,
    `${loc(trendyMaterialPath, lineOf(trendyMaterialSource, 'qrSvgMarkupCache'))} caches fetched QR SVG markup.`,
  ]);
}

const categories = [...new Set(results.map((result) => result.category))];
const findings = results.filter((result) => result.status === 'finding');

console.log('Trackpal QR/load diagnostic');
console.log(`Trackpal root: ${normalizePath(trackpalRoot)}`);
console.log(`Trendy root: ${normalizePath(trendyRoot)}`);

for (const category of categories) {
  console.log(`\n${category}`);

  for (const result of results.filter((item) => item.category === category)) {
    console.log(`[${result.status}] ${result.title}`);

    for (const detail of result.details) {
      console.log(`  - ${detail}`);
    }
  }
}

console.log(`\nFindings: ${findings.length}`);

if (findings.length > 0) {
  console.log('Likely causes:');
  console.log('- Slow load: Trackpal loads every pallet page up front, while Trendy requests one server-side page.');
  console.log('- Hard QR scanning: Trackpal hides the real camera view behind a visual overlay and its fallback scans the full frame.');
}

if (failOnFindings && findings.length > 0) {
  process.exitCode = 1;
}
