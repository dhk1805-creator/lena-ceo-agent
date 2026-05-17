#!/usr/bin/env node
require('./_env');
// Image Collage — Combine 2-4 images into professional poster
// Usage: node image-collage.js <format> <style> <hero_index> <images_csv> [output_path]
// Format: landscape (1920x1080), portrait (1080x1920), square (1080x1080)
// Style: auto, hero-left, hero-right, hero-top, equal

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const format    = process.argv[2] || 'landscape';
const style     = process.argv[3] || 'auto';
const heroIndex = parseInt(process.argv[4] || '0', 10);
const imageArgs = (process.argv[5] || '').split(',').filter(Boolean);
const outputPath = process.argv[6] || `/tmp/collage-${Date.now()}.png`;

if (imageArgs.length < 2) {
  console.log(JSON.stringify({ error: 'Can it nhat 2 anh. Usage: node image-collage.js <format> <style> <hero_index> <img1,img2,...> [output]' }));
  process.exit(1);
}
if (imageArgs.length > 4) imageArgs.length = 4;

const FORMATS = {
  landscape: { w: 1920, h: 1080 },
  portrait:  { w: 1080, h: 1920 },
  square:    { w: 1080, h: 1080 }
};
const canvas = FORMATS[format] || FORMATS.landscape;
const W = canvas.w, H = canvas.h, GAP = 8;

// Auto-select best style based on format + image count
function autoStyle(count, fmt) {
  if (count === 2) return 'equal';
  if (fmt === 'landscape') return 'hero-left';
  if (fmt === 'portrait')  return 'hero-top';
  return count <= 3 ? 'hero-top' : 'equal'; // square
}

// Calculate cell positions. Index 0 = hero (largest) position.
function getPositions(count, sty) {
  // --- HERO-LEFT: hero full-height left, others stacked right ---
  if (sty === 'hero-left') {
    const heroW = Math.floor(W * 0.6);
    const rW = W - heroW - GAP;
    const others = count - 1;
    const cH = Math.floor((H - GAP * (others - 1)) / others);
    const pos = [{ x: 0, y: 0, w: heroW, h: H }];
    for (let i = 0; i < others; i++)
      pos.push({ x: heroW + GAP, y: i * (cH + GAP), w: rW, h: cH });
    return pos;
  }

  // --- HERO-RIGHT: hero full-height right, others stacked left ---
  if (sty === 'hero-right') {
    const heroW = Math.floor(W * 0.6);
    const lW = W - heroW - GAP;
    const others = count - 1;
    const cH = Math.floor((H - GAP * (others - 1)) / others);
    const pos = [{ x: lW + GAP, y: 0, w: heroW, h: H }];
    for (let i = 0; i < others; i++)
      pos.push({ x: 0, y: i * (cH + GAP), w: lW, h: cH });
    return pos;
  }

  // --- HERO-TOP: hero full-width top, others in row below ---
  if (sty === 'hero-top') {
    const heroH = Math.floor(H * 0.6);
    const bH = H - heroH - GAP;
    const others = count - 1;
    const cW = Math.floor((W - GAP * (others - 1)) / others);
    const pos = [{ x: 0, y: 0, w: W, h: heroH }];
    for (let i = 0; i < others; i++)
      pos.push({ x: i * (cW + GAP), y: heroH + GAP, w: cW, h: bH });
    return pos;
  }

  // --- EQUAL: all cells same size ---
  if (count === 2) {
    if (format === 'portrait') {
      const cH = Math.floor((H - GAP) / 2);
      return [
        { x: 0, y: 0, w: W, h: cH },
        { x: 0, y: cH + GAP, w: W, h: cH }
      ];
    }
    const cW = Math.floor((W - GAP) / 2);
    return [
      { x: 0, y: 0, w: cW, h: H },
      { x: cW + GAP, y: 0, w: cW, h: H }
    ];
  }
  if (count === 3) {
    if (format === 'portrait') {
      const cH = Math.floor((H - GAP * 2) / 3);
      return [
        { x: 0, y: 0, w: W, h: cH },
        { x: 0, y: cH + GAP, w: W, h: cH },
        { x: 0, y: (cH + GAP) * 2, w: W, h: cH }
      ];
    }
    if (format === 'landscape') {
      const cW = Math.floor((W - GAP * 2) / 3);
      return [
        { x: 0, y: 0, w: cW, h: H },
        { x: cW + GAP, y: 0, w: cW, h: H },
        { x: (cW + GAP) * 2, y: 0, w: cW, h: H }
      ];
    }
    // square: 1 top full-width + 2 bottom
    const topH = Math.floor((H - GAP) * 0.55);
    const botH = H - topH - GAP;
    const cW = Math.floor((W - GAP) / 2);
    return [
      { x: 0, y: 0, w: W, h: topH },
      { x: 0, y: topH + GAP, w: cW, h: botH },
      { x: cW + GAP, y: topH + GAP, w: cW, h: botH }
    ];
  }
  // count === 4: 2x2 grid
  const cW = Math.floor((W - GAP) / 2);
  const cH = Math.floor((H - GAP) / 2);
  return [
    { x: 0, y: 0, w: cW, h: cH },
    { x: cW + GAP, y: 0, w: cW, h: cH },
    { x: 0, y: cH + GAP, w: cW, h: cH },
    { x: cW + GAP, y: cH + GAP, w: cW, h: cH }
  ];
}

async function resolveImage(input) {
  if (input.startsWith('http')) {
    const tmpPath = `/tmp/collage-dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
    try {
      execSync(`curl -sS -L -o "${tmpPath}" -A "Mozilla/5.0" "${input}"`, { timeout: 30000 });
      if (!fs.existsSync(tmpPath) || fs.statSync(tmpPath).size < 500) throw new Error('Too small');
      return { path: tmpPath, downloaded: true };
    } catch (e) {
      return { error: `Download failed: ${input.substring(0, 60)}` };
    }
  }
  if (!fs.existsSync(input)) return { error: `File not found: ${input}` };
  return { path: input, downloaded: false };
}

async function main() {
  let sharp;
  try { sharp = require('sharp'); } catch {
    console.log(JSON.stringify({ success: false, error: 'sharp not installed' }));
    return;
  }

  const resolved = [];
  for (const img of imageArgs) {
    const r = await resolveImage(img.trim());
    if (r.error) {
      console.log(JSON.stringify({ success: false, error: r.error }));
      return;
    }
    resolved.push(r);
  }

  const effectiveStyle = style === 'auto' ? autoStyle(resolved.length, format) : style;
  const positions = getPositions(resolved.length, effectiveStyle);

  // Reorder: hero_index image goes to position 0 (largest cell)
  const hi = Math.min(Math.max(heroIndex, 0), resolved.length - 1);
  const ordered = [resolved[hi]];
  for (let i = 0; i < resolved.length; i++) {
    if (i !== hi) ordered.push(resolved[i]);
  }

  const composites = [];
  for (let i = 0; i < ordered.length; i++) {
    const pos = positions[i];
    try {
      const buf = await sharp(ordered[i].path)
        .resize(pos.w, pos.h, { fit: 'cover', position: 'centre' })
        .toBuffer();
      composites.push({ input: buf, left: pos.x, top: pos.y });
    } catch (e) {
      console.log(JSON.stringify({ success: false, error: `Resize image ${i + 1} failed: ${e.message}` }));
      return;
    }
  }

  const outDir = path.dirname(outputPath);
  fs.mkdirSync(outDir, { recursive: true });

  await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } }
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  const size = fs.statSync(outputPath).size;
  const sizeHuman = size > 1048576 ? (size / 1048576).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + ' KB';

  console.log(JSON.stringify({
    success: true,
    output: { path: outputPath, size, sizeHuman },
    format, style: effectiveStyle, heroIndex: hi,
    imageCount: resolved.length, canvas: `${W}x${H}`,
    next_step: 'TIEP THEO: image_overlay them text/logo len anh nay → roi image_save luu vao Drive Anh_bia/. KHONG gui link /tmp cho Sep.'
  }));

  for (const r of resolved) {
    if (r.downloaded) try { fs.unlinkSync(r.path); } catch {}
  }
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
});
