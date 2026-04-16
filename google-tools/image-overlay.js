#!/usr/bin/env node
// Image Overlay Pro — Le Na CEO Agent
// Ghep logo STARDUCT + text tieng Viet len anh voi layout chuyen nghiep
//
// Usage:
//   node image-overlay.js "<input_image>" "<text>" "[output_path]" "[layout]"
//
// Layouts:
//   banner-bottom (default) — Thanh gradient duoi, logo trai, text phai
//   banner-left  — Cot doc ben trai voi gradient, text + logo
//   minimal      — Logo goc + text nho gon
//   hero         — Text lon giua, logo tren, gradient toan bo duoi
//
// Examples:
//   node image-overlay.js "/tmp/bg.png" "Cửa gió chất lượng quốc tế"
//   node image-overlay.js "/tmp/bg.png" "STARDUCT - Trusted Performance" "/tmp/final.png" "hero"
//   node image-overlay.js "/tmp/bg.png" "" "/tmp/logo-only.png" "minimal"

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const text = process.argv[3] || '';
const outputPath = process.argv[4] || `/tmp/overlay-${Date.now()}.png`;
const layout = process.argv[5] || 'banner-bottom';

if (!inputPath) {
  console.log('Usage: node image-overlay.js "<input_image>" "<text>" "[output_path]" "[layout]"');
  console.log('Layouts: banner-bottom, banner-left, minimal, hero');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.log(JSON.stringify({ error: `File khong ton tai: ${inputPath}` }));
  process.exit(1);
}

const LOGO_PATH = '/app/assets/logo-color.png';
const LOGO_WHITE_PATH = '/app/assets/logo-white.png';
const LOGO_SLOGAN_PATH = '/app/assets/logo-slogan.png';

async function overlay() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log(JSON.stringify({ error: 'Thu vien sharp chua cai. Chay: npm install sharp' }));
    process.exit(1);
  }

  try {
    const inputMeta = await sharp(inputPath).metadata();
    const W = inputMeta.width;
    const H = inputMeta.height;

    let composites = [];

    switch (layout) {
      case 'banner-left':
        composites = await layoutBannerLeft(sharp, W, H);
        break;
      case 'minimal':
        composites = await layoutMinimal(sharp, W, H);
        break;
      case 'hero':
        composites = await layoutHero(sharp, W, H);
        break;
      case 'banner-bottom':
      default:
        composites = await layoutBannerBottom(sharp, W, H);
        break;
    }

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
      layout,
      fileSizeMB: sizeMB,
      dimensions: `${W}x${H}`,
      note: `Banner chuyen nghiep da tao. Dung --media de gui qua Zalo/email.`
    }, null, 2));

  } catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
  }

  // ============================================================
  // LAYOUT: banner-bottom — Thanh gradient phia duoi
  // Logo ben trai, text ben phai, gradient tu trong sang den
  // ============================================================
  async function layoutBannerBottom(sharp, W, H) {
    const items = [];
    const barH = Math.round(H * 0.18);
    const barY = H - barH;
    const pad = Math.round(W * 0.03);

    // Gradient bar (dark overlay at bottom)
    const barSvg = `<svg width="${W}" height="${barH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gBottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="30%" stop-color="#000000" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${barH}" fill="url(#gBottom)"/>
      <rect x="0" y="${barH - 4}" width="${W}" height="4" fill="#F7941D"/>
    </svg>`;
    items.push({ input: Buffer.from(barSvg), top: barY, left: 0 });

    // Logo (bottom-left)
    const logo = await loadLogo(sharp, LOGO_WHITE_PATH, LOGO_PATH, Math.round(W * 0.12));
    if (logo) {
      const logoMeta = await sharp(logo).metadata();
      items.push({
        input: logo,
        top: barY + Math.round((barH - logoMeta.height) / 2),
        left: pad
      });
    }

    // Text (right of logo)
    if (text && text.trim()) {
      const textLeft = logo ? pad + Math.round(W * 0.14) : pad;
      const fontSize = Math.round(barH * 0.32);
      const textW = W - textLeft - pad;
      const lines = wrapText(text, Math.floor(textW / (fontSize * 0.52)));
      const lineH = Math.round(fontSize * 1.3);
      const textH = lines.length * lineH;
      const textY = Math.round((barH - textH) / 2);

      const textSvg = `<svg width="${textW}" height="${barH}" xmlns="http://www.w3.org/2000/svg">
        ${lines.map((line, i) =>
          `<text x="0" y="${textY + fontSize + i * lineH}"
                 font-family="Noto Sans, Arial, sans-serif"
                 font-size="${fontSize}" font-weight="bold"
                 fill="#FFFFFF">${esc(line)}</text>`
        ).join('')}
        <text x="0" y="${textY + fontSize + lines.length * lineH + Math.round(fontSize * 0.5)}"
              font-family="Noto Sans, Arial, sans-serif"
              font-size="${Math.round(fontSize * 0.4)}" font-weight="normal"
              fill="#F7941D">starduct.vn  |  Trusted Performance</text>
      </svg>`;
      items.push({ input: Buffer.from(textSvg), top: barY, left: textLeft });
    }

    return items;
  }

  // ============================================================
  // LAYOUT: banner-left — Cot doc ben trai
  // Gradient cam doc + logo + text
  // ============================================================
  async function layoutBannerLeft(sharp, W, H) {
    const items = [];
    const colW = Math.round(W * 0.32);
    const pad = Math.round(colW * 0.1);

    // Left column with gradient
    const colSvg = `<svg width="${colW}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gLeft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#F7941D" stop-opacity="0.95"/>
          <stop offset="85%" stop-color="#F7941D" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#F7941D" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${colW}" height="${H}" fill="url(#gLeft)"/>
    </svg>`;
    items.push({ input: Buffer.from(colSvg), top: 0, left: 0 });

    // Logo top of column
    const logo = await loadLogo(sharp, LOGO_WHITE_PATH, LOGO_PATH, Math.round(colW * 0.55));
    if (logo) {
      items.push({ input: logo, top: Math.round(H * 0.08), left: pad });
    }

    // Text in column
    if (text && text.trim()) {
      const fontSize = Math.round(H * 0.055);
      const lineH = Math.round(fontSize * 1.35);
      const textW = colW - pad * 2;
      const lines = wrapText(text, Math.floor(textW / (fontSize * 0.52)));
      const textH = lines.length * lineH + Math.round(fontSize * 2);
      const textY = Math.round(H * 0.35);

      const textSvg = `<svg width="${textW}" height="${textH}" xmlns="http://www.w3.org/2000/svg">
        ${lines.map((line, i) =>
          `<text x="0" y="${fontSize + i * lineH}"
                 font-family="Noto Sans, Arial, sans-serif"
                 font-size="${fontSize}" font-weight="bold"
                 fill="#FFFFFF">${esc(line)}</text>`
        ).join('')}
        <line x1="0" y1="${lines.length * lineH + 15}" x2="${Math.round(textW * 0.4)}" y2="${lines.length * lineH + 15}" stroke="#FFFFFF" stroke-width="3"/>
        <text x="0" y="${lines.length * lineH + 40}"
              font-family="Noto Sans, Arial, sans-serif"
              font-size="${Math.round(fontSize * 0.45)}"
              fill="#FFFFFF" opacity="0.9">starduct.vn</text>
      </svg>`;
      items.push({ input: Buffer.from(textSvg), top: textY, left: pad });
    }

    return items;
  }

  // ============================================================
  // LAYOUT: hero — Text lon giua, gradient day du
  // ============================================================
  async function layoutHero(sharp, W, H) {
    const items = [];
    const pad = Math.round(W * 0.05);

    // Full dark gradient overlay
    const gradSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gHero" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.3"/>
          <stop offset="40%" stop-color="#000000" stop-opacity="0.1"/>
          <stop offset="60%" stop-color="#000000" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.7"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#gHero)"/>
      <rect x="0" y="${H - 5}" width="${W}" height="5" fill="#F7941D"/>
    </svg>`;
    items.push({ input: Buffer.from(gradSvg), top: 0, left: 0 });

    // Logo top-center
    const logo = await loadLogo(sharp, LOGO_WHITE_PATH, LOGO_PATH, Math.round(W * 0.15));
    if (logo) {
      const logoMeta = await sharp(logo).metadata();
      items.push({
        input: logo,
        top: Math.round(H * 0.06),
        left: Math.round((W - logoMeta.width) / 2)
      });
    }

    // Large centered text
    if (text && text.trim()) {
      const fontSize = Math.round(H * 0.09);
      const lineH = Math.round(fontSize * 1.3);
      const textW = W - pad * 2;
      const lines = wrapText(text, Math.floor(textW / (fontSize * 0.52)));
      const textH = lines.length * lineH + Math.round(fontSize * 2);

      const textSvg = `<svg width="${textW}" height="${textH}" xmlns="http://www.w3.org/2000/svg">
        ${lines.map((line, i) =>
          `<text x="${Math.round(textW / 2)}" y="${fontSize + i * lineH}"
                 font-family="Noto Sans, Arial, sans-serif"
                 font-size="${fontSize}" font-weight="bold"
                 fill="#FFFFFF" text-anchor="middle"
                 >${esc(line)}</text>`
        ).join('')}
        <text x="${Math.round(textW / 2)}" y="${lines.length * lineH + Math.round(fontSize * 0.8)}"
              font-family="Noto Sans, Arial, sans-serif"
              font-size="${Math.round(fontSize * 0.3)}" font-weight="normal" letter-spacing="4"
              fill="#F7941D" text-anchor="middle">TRUSTED PERFORMANCE  ★  STARDUCT.VN</text>
      </svg>`;
      items.push({
        input: Buffer.from(textSvg),
        top: Math.round(H * 0.4),
        left: pad
      });
    }

    return items;
  }

  // ============================================================
  // LAYOUT: minimal — Logo goc + text nho
  // ============================================================
  async function layoutMinimal(sharp, W, H) {
    const items = [];
    const pad = Math.round(W * 0.03);

    // Logo top-right
    const logo = await loadLogo(sharp, LOGO_PATH, LOGO_WHITE_PATH, Math.round(W * 0.1));
    if (logo) {
      const logoMeta = await sharp(logo).metadata();
      items.push({
        input: logo,
        top: pad,
        left: W - logoMeta.width - pad
      });
    }

    // Small text bottom-right with subtle bg
    if (text && text.trim()) {
      const fontSize = Math.round(H * 0.035);
      const textW = Math.round(W * 0.4);
      const textH = Math.round(fontSize * 2.5);

      const textSvg = `<svg width="${textW}" height="${textH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${textW}" height="${textH}" rx="4" fill="#000000" opacity="0.5"/>
        <text x="${Math.round(textW / 2)}" y="${Math.round(textH * 0.6)}"
              font-family="Noto Sans, Arial, sans-serif"
              font-size="${fontSize}" font-weight="600"
              fill="#FFFFFF" text-anchor="middle">${esc(text)}</text>
      </svg>`;
      items.push({
        input: Buffer.from(textSvg),
        top: H - textH - pad,
        left: W - textW - pad
      });
    }

    return items;
  }
}

// ============================================================
// HELPERS
// ============================================================
async function loadLogo(sharp, primary, fallback, width) {
  const file = fs.existsSync(primary) ? primary :
               fs.existsSync(fallback) ? fallback : null;
  if (!file) return null;
  return sharp(file).resize(width).toBuffer();
}

function wrapText(text, charsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > charsPerLine && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

overlay();
