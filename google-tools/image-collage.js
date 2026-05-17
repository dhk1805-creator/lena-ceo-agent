#!/usr/bin/env node
require('./_env');
// Image Collage — Combine 2-4 images into a single composite
// Usage: node image-collage.js <layout> <images_comma_separated> [output_path]
// Layouts: grid (auto), row (horizontal strip), col (vertical stack)
// Images: comma-separated local paths or URLs

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const layout = process.argv[2] || 'grid';
const imageArgs = (process.argv[3] || '').split(',').filter(Boolean);
const outputPath = process.argv[4] || `/tmp/collage-${Date.now()}.png`;

if (imageArgs.length < 2) {
  console.log(JSON.stringify({ error: 'Can it nhat 2 anh. Usage: node image-collage.js <layout> <img1,img2,...> [output]' }));
  process.exit(1);
}
if (imageArgs.length > 4) imageArgs.length = 4;

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const GAP = 6;

function getPositions(count, lay) {
  if (lay === 'row') {
    const cellW = Math.floor((CANVAS_W - GAP * (count - 1)) / count);
    return Array.from({ length: count }, (_, i) => ({
      x: i * (cellW + GAP), y: 0, w: cellW, h: CANVAS_H
    }));
  }
  if (lay === 'col') {
    const cellH = Math.floor((CANVAS_H - GAP * (count - 1)) / count);
    return Array.from({ length: count }, (_, i) => ({
      x: 0, y: i * (cellH + GAP), w: CANVAS_W, h: cellH
    }));
  }
  // grid (default)
  if (count === 2) {
    const cellW = Math.floor((CANVAS_W - GAP) / 2);
    return [
      { x: 0, y: 0, w: cellW, h: CANVAS_H },
      { x: cellW + GAP, y: 0, w: cellW, h: CANVAS_H }
    ];
  }
  if (count === 3) {
    const leftW = Math.floor(CANVAS_W * 0.55);
    const rightW = CANVAS_W - leftW - GAP;
    const cellH = Math.floor((CANVAS_H - GAP) / 2);
    return [
      { x: 0, y: 0, w: leftW, h: CANVAS_H },
      { x: leftW + GAP, y: 0, w: rightW, h: cellH },
      { x: leftW + GAP, y: cellH + GAP, w: rightW, h: cellH }
    ];
  }
  // count === 4: 2x2
  const cellW = Math.floor((CANVAS_W - GAP) / 2);
  const cellH = Math.floor((CANVAS_H - GAP) / 2);
  return [
    { x: 0, y: 0, w: cellW, h: cellH },
    { x: cellW + GAP, y: 0, w: cellW, h: cellH },
    { x: 0, y: cellH + GAP, w: cellW, h: cellH },
    { x: cellW + GAP, y: cellH + GAP, w: cellW, h: cellH }
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
    console.log(JSON.stringify({ success: false, error: 'sharp not installed. Run: npm install sharp' }));
    return;
  }

  // Resolve all images
  const resolved = [];
  for (const img of imageArgs) {
    const r = await resolveImage(img.trim());
    if (r.error) {
      console.log(JSON.stringify({ success: false, error: r.error }));
      return;
    }
    resolved.push(r);
  }

  const positions = getPositions(resolved.length, layout);

  // Resize each image to its cell size
  const composites = [];
  for (let i = 0; i < resolved.length; i++) {
    const pos = positions[i];
    try {
      const buf = await sharp(resolved[i].path)
        .resize(pos.w, pos.h, { fit: 'cover', position: 'centre' })
        .toBuffer();
      composites.push({ input: buf, left: pos.x, top: pos.y });
    } catch (e) {
      console.log(JSON.stringify({ success: false, error: `Resize failed image ${i + 1}: ${e.message}` }));
      return;
    }
  }

  // Create canvas and composite
  const outDir = path.dirname(outputPath);
  fs.mkdirSync(outDir, { recursive: true });

  await sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: { r: 255, g: 255, b: 255 } }
  })
    .composite(composites)
    .png({ quality: 90 })
    .toFile(outputPath);

  const size = fs.statSync(outputPath).size;
  const sizeHuman = size > 1048576 ? (size / 1048576).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + ' KB';

  console.log(JSON.stringify({
    success: true,
    output: { path: outputPath, size, sizeHuman },
    layout,
    imageCount: resolved.length,
    canvas: `${CANVAS_W}x${CANVAS_H}`,
    note: 'Dung image_overlay hoac image_poster de them branding/text len anh nay'
  }));

  // Cleanup downloaded files
  for (const r of resolved) {
    if (r.downloaded) try { fs.unlinkSync(r.path); } catch {}
  }
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
});
