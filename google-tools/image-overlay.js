#!/usr/bin/env node
// Image Overlay — Le Na CEO Agent
// Ghep logo STARDUCT + text tieng Viet chinh xac len anh
//
// Usage:
//   node image-overlay.js "<input_image>" "<text>" "[output_path]" "[position]"
//
// Positions: bottom-left (default), top-left, top-right, bottom-right, center
//
// Examples:
//   node image-overlay.js "/tmp/dalle-123.png" "Cửa gió chất lượng quốc tế"
//   node image-overlay.js "/tmp/dalle-123.png" "STARDUCT - Trusted Performance" "/tmp/banner-final.png" "bottom-left"
//   node image-overlay.js "/tmp/dalle-123.png" "" "/tmp/logo-only.png"
//     → Chi ghep logo, khong co text

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const text = process.argv[3] || '';
const outputPath = process.argv[4] || `/tmp/overlay-${Date.now()}.png`;
const position = process.argv[5] || 'bottom-left';

if (!inputPath) {
  console.log('Usage: node image-overlay.js "<input_image>" "<text>" "[output_path]" "[position]"');
  console.log('Positions: bottom-left, top-left, top-right, bottom-right, center');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.log(JSON.stringify({ error: `File khong ton tai: ${inputPath}` }));
  process.exit(1);
}

const LOGO_PATH = '/app/assets/logo-color.png';
const LOGO_WHITE_PATH = '/app/assets/logo-white.png';

// Brand colors
const BRAND_ORANGE = '#F7941D';
const BRAND_DARK = '#4A4A4A';
const BRAND_BLACK = '#000000';
const BRAND_WHITE = '#FFFFFF';

async function overlay() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log(JSON.stringify({
      error: 'Thu vien sharp chua cai dat. Chay: npm install -g sharp',
      fix: 'Them sharp vao Dockerfile: RUN npm install -g sharp'
    }));
    process.exit(1);
  }

  try {
    // Read input image dimensions
    const inputMeta = await sharp(inputPath).metadata();
    const imgWidth = inputMeta.width;
    const imgHeight = inputMeta.height;

    const composites = [];

    // --- 1. Add LOGO ---
    const logoFile = fs.existsSync(LOGO_PATH) ? LOGO_PATH :
                     fs.existsSync(LOGO_WHITE_PATH) ? LOGO_WHITE_PATH : null;

    if (logoFile) {
      // Resize logo to ~15% of image width
      const logoWidth = Math.round(imgWidth * 0.15);
      const logoBuffer = await sharp(logoFile)
        .resize(logoWidth)
        .toBuffer();

      const logoMeta = await sharp(logoBuffer).metadata();
      const logoHeight = logoMeta.height;

      // Logo position: top-right corner with padding
      const logoPadding = Math.round(imgWidth * 0.03);
      composites.push({
        input: logoBuffer,
        top: logoPadding,
        left: imgWidth - logoWidth - logoPadding
      });
    }

    // --- 2. Add TEXT ---
    if (text && text.trim()) {
      const fontSize = Math.round(imgHeight * 0.06); // 6% of image height
      const lineHeight = Math.round(fontSize * 1.4);
      const padding = Math.round(imgWidth * 0.04);
      const maxTextWidth = Math.round(imgWidth * 0.6);

      // Word wrap text
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      const charsPerLine = Math.floor(maxTextWidth / (fontSize * 0.55));

      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > charsPerLine && currentLine) {
          lines.push(currentLine.trim());
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      }
      if (currentLine.trim()) lines.push(currentLine.trim());

      const textBlockHeight = lines.length * lineHeight + padding * 2;
      const textBlockWidth = maxTextWidth + padding * 2;

      // Create text SVG with Vietnamese support
      const textSvg = `<svg width="${textBlockWidth}" height="${textBlockHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.3"/>
          </filter>
        </defs>
        <rect x="0" y="0" width="${textBlockWidth}" height="${textBlockHeight}" rx="8" ry="8" fill="${BRAND_ORANGE}" opacity="0.9"/>
        ${lines.map((line, i) =>
          `<text x="${padding}" y="${padding + fontSize + i * lineHeight}"
                 font-family="Arial, Helvetica, sans-serif"
                 font-size="${fontSize}"
                 font-weight="bold"
                 fill="${BRAND_WHITE}"
                 filter="url(#shadow)">${escapeXml(line)}</text>`
        ).join('\n')}
      </svg>`;

      const textBuffer = Buffer.from(textSvg);

      // Position text block
      let textTop, textLeft;
      switch (position) {
        case 'top-left':
          textTop = padding;
          textLeft = padding;
          break;
        case 'top-right':
          textTop = padding;
          textLeft = imgWidth - textBlockWidth - padding;
          break;
        case 'bottom-right':
          textTop = imgHeight - textBlockHeight - padding;
          textLeft = imgWidth - textBlockWidth - padding;
          break;
        case 'center':
          textTop = Math.round((imgHeight - textBlockHeight) / 2);
          textLeft = Math.round((imgWidth - textBlockWidth) / 2);
          break;
        case 'bottom-left':
        default:
          textTop = imgHeight - textBlockHeight - padding;
          textLeft = padding;
          break;
      }

      composites.push({
        input: textBuffer,
        top: textTop,
        left: textLeft
      });
    }

    // --- 3. Composite and save ---
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });

    await sharp(inputPath)
      .composite(composites)
      .png()
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);

    console.log(JSON.stringify({
      success: true,
      input: inputPath,
      output: outputPath,
      text: text || '(chi logo)',
      position,
      fileSizeMB: sizeMB,
      dimensions: `${imgWidth}x${imgHeight}`,
      note: `Anh da ghep logo + text. Dung --media de gui qua Zalo hoac dinh kem email.`
    }, null, 2));

  } catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

overlay();
