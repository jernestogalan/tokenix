#!/usr/bin/env node
/**
 * Tokenia OG Image Generator
 * Usage: node scripts/generate-og.js
 * Requires: npm install --save-dev sharp  (or uses ImageMagick as fallback)
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT = path.join(__dirname, '..', 'public', 'og-image.png');
const SVG = path.join(__dirname, '..', 'public', 'og-image.svg');

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF4ED"/>
      <stop offset="100%" style="stop-color:#FFFFFF"/>
    </linearGradient>
    <linearGradient id="orange" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#FF6B2C"/>
      <stop offset="100%" style="stop-color:#FF9A5C"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="6" fill="url(#orange)"/>
  <rect x="80" y="70" width="80" height="80" rx="20" fill="url(#orange)"/>
  <path d="M95 110h20l8-22 14 44 8-30 6 8H175" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="180" y="128" font-family="system-ui,sans-serif" font-size="56" font-weight="900" fill="#0A0A0A">Tokenia</text>
  <text x="80" y="260" font-family="system-ui,sans-serif" font-size="72" font-weight="900" fill="#0A0A0A">Count Tokens.</text>
  <text x="80" y="350" font-family="system-ui,sans-serif" font-size="72" font-weight="900" fill="#FF6B2C">Cut Costs.</text>
  <text x="80" y="430" font-family="system-ui,sans-serif" font-size="28" fill="#525252">Free LLM Token Calculator · 30+ Models · 5 Languages · 100% Private</text>
  <rect x="80"  y="490" width="180" height="44" rx="22" fill="#F5F5F5" stroke="#E5E5E5" stroke-width="1.5"/>
  <text x="170" y="518" font-family="system-ui,sans-serif" font-size="18" fill="#525252" text-anchor="middle">🔒 No Tracking</text>
  <rect x="280" y="490" width="180" height="44" rx="22" fill="#F5F5F5" stroke="#E5E5E5" stroke-width="1.5"/>
  <text x="370" y="518" font-family="system-ui,sans-serif" font-size="18" fill="#525252" text-anchor="middle">✅ Free Forever</text>
  <rect x="480" y="490" width="160" height="44" rx="22" fill="#F5F5F5" stroke="#E5E5E5" stroke-width="1.5"/>
  <text x="560" y="518" font-family="system-ui,sans-serif" font-size="18" fill="#525252" text-anchor="middle">🌍 5 Languages</text>
  <text x="1120" y="590" font-family="system-ui,sans-serif" font-size="24" fill="#A3A3A3" text-anchor="end">tokenia.live</text>
  <rect y="624" width="1200" height="6" fill="url(#orange)"/>
</svg>`;

fs.writeFileSync(SVG, svg);
console.log('✅ SVG written.');

// Try sharp first, fall back to ImageMagick
try {
  const sharp = require('sharp');
  sharp(Buffer.from(svg)).resize(1200, 630).png().toFile(OUT, (err) => {
    if (err) throw err;
    console.log(`✅ PNG generated via sharp: ${OUT}`);
  });
} catch {
  try {
    execSync(`convert -background white -size 1200x630 "${SVG}" "${OUT}"`, { stdio: 'inherit' });
    console.log(`✅ PNG generated via ImageMagick: ${OUT}`);
  } catch (e2) {
    console.log('⚠️  Could not generate PNG. SVG is at public/og-image.svg — convert manually.');
  }
}
