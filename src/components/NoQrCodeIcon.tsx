import React from 'react';

interface NoQrCodeIconProps {
  size?: number;
  className?: string;
}

export const NoQrCodeIcon: React.FC<NoQrCodeIconProps> = ({
  size = 24,
  className,
}) => (
  <span
    className={`relative inline-flex shrink-0 ${className || ''}`}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Match the QR Scan icon's line style, but leave the upper-right finder clear for ?. */}
      <rect x="3" y="3" width="5" height="5" rx="1" />
      <rect x="3" y="16" width="5" height="5" rx="1" />
      <rect x="16" y="16" width="5" height="5" rx="1" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M12 16v.01" />
      <path d="M12 21v-1" />
      <path d="M3 12h.01" />
      <path d="M11 14h.01" />
      <path d="M14 13h.01" />
      <path d="M14 18h.01" />
    </svg>
    <span
      className="pointer-events-none absolute right-0 top-0 flex items-center justify-center font-black leading-none text-current"
      style={{
        width: Math.round(size * 0.48),
        height: Math.round(size * 0.48),
        fontSize: Math.round(size * 0.54),
      }}
    >
      ?
    </span>
  </span>
);
