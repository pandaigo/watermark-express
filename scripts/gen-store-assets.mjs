import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'store');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>

  <rect width="440" height="280" fill="url(#bg)"/>

  <!-- Icon -->
  <g transform="translate(24, 24)">
    <rect width="52" height="52" rx="12" fill="white" opacity="0.15"/>
    <text x="26" y="38" text-anchor="middle" font-family="Arial,sans-serif"
          font-weight="900" font-size="30" fill="white">W</text>
    <circle cx="42" cy="12" r="5" fill="white" opacity="0.5"/>
  </g>

  <!-- Headline -->
  <text x="24" y="120" font-family="system-ui,sans-serif" font-size="32" font-weight="700" fill="white">Watermark</text>
  <text x="24" y="158" font-family="system-ui,sans-serif" font-size="32" font-weight="700" fill="white">in seconds.</text>

  <!-- Subtitle -->
  <text x="24" y="188" font-family="system-ui,sans-serif" font-size="14" fill="white" opacity="0.85">Drag. Drop. Protected.</text>

  <!-- Product name -->
  <text x="24" y="256" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="white" opacity="0.9">Watermark Express</text>

  <!-- Mock UI: product photo with watermark -->
  <g transform="translate(260, 125)">
    <rect x="0" y="0" width="160" height="130" rx="8" fill="white" opacity="0.18"/>
    <rect x="8" y="8" width="144" height="114" rx="4" fill="white" opacity="0.12"/>
    <!-- Product: handbag silhouette -->
    <rect x="52" y="50" width="56" height="48" rx="4" fill="white" opacity="0.2"/>
    <rect x="56" y="54" width="48" height="40" rx="3" fill="white" opacity="0.15"/>
    <!-- Handle -->
    <path d="M64,54 Q64,34 80,34 Q96,34 96,54" stroke="white" stroke-width="3" fill="none" opacity="0.25"/>
    <!-- Clasp -->
    <circle cx="80" cy="70" r="3" fill="white" opacity="0.25"/>
    <!-- Price tag -->
    <rect x="20" y="90" width="36" height="16" rx="3" fill="white" opacity="0.2"/>
    <text x="38" y="102" text-anchor="middle" font-family="Arial,sans-serif"
          font-size="8" fill="white" opacity="0.4">$49</text>
    <!-- Watermark overlay - more visible -->
    <text x="80" y="78" text-anchor="middle" font-family="Arial,sans-serif"
          font-weight="800" font-size="16" fill="white" opacity="0.45"
          transform="rotate(-25, 80, 78)">SAMPLE</text>
    <!-- Cursor -->
    <polygon points="138,108 138,128 146,121" fill="white" opacity="0.75"/>
  </g>
</svg>`;

writeFileSync(join(outDir, 'promo-small-440x280.svg'), svg);
console.log('Generated promo-small-440x280.svg');

await sharp(Buffer.from(svg))
  .png()
  .toFile(join(outDir, 'promo-small-440x280.png'));
console.log('Generated promo-small-440x280.png');

console.log('Done');
