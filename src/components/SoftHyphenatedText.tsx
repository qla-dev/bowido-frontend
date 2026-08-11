import React from 'react';

interface SoftHyphenatedTextProps {
  children: string;
  className?: string;
}

/** Adds optional break points inside words; a hyphen appears only when a word wraps. */
export const SoftHyphenatedText: React.FC<SoftHyphenatedTextProps> = ({ children, className }) => (
  <span
    className={className}
    style={{ hyphens: 'manual', overflowWrap: 'normal', wordBreak: 'normal' }}
  >
    {children.split(/(\s+)/).map((part) => (/\s/.test(part) ? part : Array.from(part).join('\u00ad')))}
  </span>
);
