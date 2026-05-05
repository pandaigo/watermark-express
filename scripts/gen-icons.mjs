import sharp from 'sharp';
import { resolve } from 'path';

const outDir = resolve(import.meta.dirname, '..', 'icons');

function buildSvg(size) {
  const pad = size * 0.1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="url(#bg)"/>
  <g transform="translate(${cx}, ${cy})">
    <!-- Stylized "W" for Watermark -->
    <text x="0" y="${size * 0.08}" text-anchor="middle" font-family="Arial, sans-serif"
          font-weight="900" font-size="${size * 0.55}" fill="white" opacity="0.95">W</text>
    <!-- Droplet accent -->
    <circle cx="${size * 0.22}" cy="${-size * 0.18}" r="${size * 0.07}" fill="white" opacity="0.6"/>
  </g>
</svg>`;
}

const sizes = [16, 48, 128];

for (const s of sizes) {
  const svg = buildSvg(s);
  await sharp(Buffer.from(svg))
    .png()
    .toFile(resolve(outDir, `icon${s}.png`));
  console.log(`Generated icon${s}.png`);
}

console.log('Done');
