import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { createQrMatrix } from './qrCode';

export type QrExportFormat = 'svg' | 'png' | 'jpg' | 'pdf';

const QR_SIZE = 900;
const QUIET_ZONE = 4;

const safeFileName = (value: string) => value.replace(/[^a-z0-9._-]/gi, '_');

const matrixToSvg = (value: string) => {
  const matrix = createQrMatrix(value);
  const size = matrix.length + QUIET_ZONE * 2;
  const path = matrix
    .flatMap((row, y) => row.map((dark, x) =>
      dark ? `M${x + QUIET_ZONE},${y + QUIET_ZONE}h1v1h-1z` : '',
    ))
    .filter(Boolean)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#09090b"/></svg>`;
};

const svgToRaster = async (svg: string, mimeType: 'image/png' | 'image/jpeg') => {
  const image = new Image();
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to render QR image.'));
      image.src = source;
    });
    const canvas = document.createElement('canvas');
    canvas.width = QR_SIZE;
    canvas.height = QR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create QR image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, QR_SIZE, QR_SIZE);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, QR_SIZE, QR_SIZE);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to create QR image.')), mimeType, 0.96),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
};

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Creates print-ready QR labels. Image exports contain one label per ZIP entry;
 * PDF contains all labels in a single, easy-to-print document. */
const exportPalletQrCodesForFormat = async (codes: string[], format: QrExportFormat, fileNameBase: string) => {
  if (format === 'pdf') {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const labelSize = 52;
    const positions = [[18, 18], [80, 18], [142, 18], [18, 92], [80, 92], [142, 92], [18, 166], [80, 166], [142, 166]];

    for (let index = 0; index < codes.length; index++) {
      if (index > 0 && index % positions.length === 0) pdf.addPage();
      const [x, y] = positions[index % positions.length];
      const svg = matrixToSvg(codes[index]);
      const image = await svgToRaster(svg, 'image/png');
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(image);
      });
      pdf.addImage(dataUrl, 'PNG', x, y, labelSize, labelSize);
      pdf.setFontSize(9);
      pdf.text(codes[index], x + labelSize / 2, y + labelSize + 6, { align: 'center' });
    }
    pdf.save(`${safeFileName(fileNameBase)}.pdf`);
    return;
  }

  const zip = new JSZip();
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  await Promise.all(codes.map(async (code) => {
    const svg = matrixToSvg(code);
    zip.file(`${safeFileName(code)}.${format}`, format === 'svg' ? svg : await svgToRaster(svg, mimeType));
  }));
  download(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `${safeFileName(fileNameBase)}-${format}.zip`);
};

export const exportPalletQrCodes = async (codes: string[], formats: QrExportFormat[], fileNameBase = 'trackpal-qr-labels') => {
  await Promise.all(formats.map((format) => exportPalletQrCodesForFormat(codes, format, fileNameBase)));
};
