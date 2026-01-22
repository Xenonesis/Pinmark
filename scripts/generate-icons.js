/**
 * Icon Generation Script
 *
 * This script generates PNG icons from SVG source.
 * Run with: node scripts/generate-icons.js
 *
 * Requires: npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="20" fill="#3b82f6"/>
  <circle cx="64" cy="50" r="18" fill="#ffffff"/>
  <path d="M30 110 Q64 70 98 110" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="30" cy="85" r="6" fill="#ef4444"/>
  <circle cx="98" cy="85" r="6" fill="#ef4444"/>
</svg>
`;

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, '../src/icons');

async function generateIcons() {
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}.png`);

    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated: ${outputPath}`);
  }

  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
