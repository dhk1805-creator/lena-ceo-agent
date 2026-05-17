#!/usr/bin/env node
require('./_env');
// Image Poster — Edit product image with OpenAI to create professional cover/poster
// Usage: node image-poster.js <imageUrl_or_path> "<edit_prompt>" [output_path]
// Takes a product photo → places it in professional context based on prompt

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const imageInput = process.argv[2];
const editPrompt = process.argv[3];
const outputPath = process.argv[4] || `/tmp/poster-${Date.now()}.png`;

if (!imageInput || !editPrompt) {
  console.log(JSON.stringify({ error: 'Usage: node image-poster.js <imageUrl_or_path> "<edit_prompt>" [output_path]' }));
  process.exit(1);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.log(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }));
  process.exit(1);
}

async function main() {
  const tmpDir = '/tmp/poster-work';
  fs.mkdirSync(tmpDir, { recursive: true });

  // Resolve image: URL → download, path → use directly
  let imagePath;
  if (imageInput.startsWith('http')) {
    imagePath = path.join(tmpDir, `input-${Date.now()}.png`);
    try {
      execSync(`curl -sS -L -o "${imagePath}" -A "Mozilla/5.0" "${imageInput}"`, { timeout: 30000 });
    } catch (e) {
      console.log(JSON.stringify({ success: false, error: 'Download failed: ' + e.message }));
      return;
    }
  } else {
    imagePath = imageInput;
  }

  if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size < 1000) {
    console.log(JSON.stringify({ success: false, error: 'Image file missing or too small' }));
    return;
  }

  // Build multipart form for OpenAI Images Edit API
  const imageBuffer = fs.readFileSync(imagePath);
  const boundary = '----OpenAIPoster' + Date.now();

  const fullPrompt = `${editPrompt}

IMPORTANT: Keep the original product clearly visible and recognizable. Create a professional, high-quality composition. Do NOT add any text, letters, words, numbers, logos, or watermarks. Pure visual only.`;

  // Construct multipart body
  const parts = [];
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-1`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${fullPrompt}`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n1024x1024`);

  const headerPart = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="product.png"\r\nContent-Type: image/png\r\n\r\n`;
  const endPart = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(parts.join('\r\n') + '\r\n'),
    Buffer.from(headerPart),
    imageBuffer,
    Buffer.from(endPart)
  ]);

  // Call OpenAI
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    const err = await res.text();
    console.log(JSON.stringify({ success: false, error: `OpenAI API ${res.status}`, detail: err.substring(0, 300) }));
    return;
  }

  const data = await res.json();

  if (!data.data || !data.data[0]) {
    console.log(JSON.stringify({ success: false, error: 'No image in response', detail: JSON.stringify(data).substring(0, 200) }));
    return;
  }

  // Save result
  const resultData = data.data[0].b64_json || null;
  const resultUrl = data.data[0].url || null;

  const outDir = path.dirname(outputPath);
  fs.mkdirSync(outDir, { recursive: true });

  if (resultData) {
    fs.writeFileSync(outputPath, Buffer.from(resultData, 'base64'));
  } else if (resultUrl) {
    execSync(`curl -sS -L -o "${outputPath}" "${resultUrl}"`, { timeout: 30000 });
  } else {
    console.log(JSON.stringify({ success: false, error: 'No b64_json or url in response' }));
    return;
  }

  const size = fs.statSync(outputPath).size;
  const sizeHuman = size > 1048576 ? (size / 1048576).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + ' KB';

  console.log(JSON.stringify({
    success: true,
    output: { path: outputPath, size, sizeHuman },
    prompt: editPrompt.substring(0, 100),
    next_step: 'TIEP THEO: image_overlay them text/logo → roi image_save luu vao Drive Anh_bia/. KHONG gui link /tmp cho Sep.'
  }));

  // Cleanup input if downloaded
  if (imageInput.startsWith('http')) {
    try { fs.unlinkSync(imagePath); } catch {}
  }
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
});
