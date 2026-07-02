import React, { useMemo } from 'react';
import { createQrMatrix } from '../lib/qrCode';

interface PalletQrCodeProps {
  value: string;
  className?: string;
}

export const PalletQrCode: React.FC<PalletQrCodeProps> = ({ value, className }) => {
  const matrix = useMemo(() => {
    try {
      return createQrMatrix(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) {
    return (
      <div className={className}>
        <div className="flex aspect-square items-center justify-center rounded-3xl bg-zinc-100 px-6 text-center text-xs font-black uppercase tracking-widest text-zinc-400">
          QR value too long
        </div>
      </div>
    );
  }

  const quietZone = 4;
  const viewBoxSize = matrix.length + quietZone * 2;
  const darkPath = matrix
    .flatMap((row, y) =>
      row.map((isDark, x) =>
        isDark ? `M${x + quietZone},${y + quietZone}h1v1h-1z` : ''
      )
    )
    .filter(Boolean)
    .join('');

  return (
    <svg
      className={className}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      role="img"
      aria-label={value}
      shapeRendering="crispEdges"
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="white" />
      <path d={darkPath} fill="currentColor" />
    </svg>
  );
};
