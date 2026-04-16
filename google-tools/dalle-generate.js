#!/usr/bin/env node
// DALL-E Image Generate — Le Na CEO Agent
// Tao hinh anh bang OpenAI DALL-E 3
// Dung cho: banner fanpage, thiep chuc mung, poster san pham, infographic
//
// Usage:
//   node dalle-generate.js "<mo ta hinh anh>" "[size]" "[output_path]"
//
// Sizes: 1024x1024 (default), 1792x1024 (landscape), 1024x1792 (portrait)
//
// Examples:
//   node dalle-generate.js "Banner HVAC chuyen nghiep cho cong ty STARDUCT"
//   node dalle-generate.js "Thiep chuc mung sinh nhat phong cach cong ty" "1792x1024"
//   node dalle-generate.js "Poster san pham cua gio STARDUCT" "1024x1792" "/tmp/poster.png"

const fs = require('fs');
const path = require('path');

const prompt = process.argv[2];
const size = process.argv[3] || '1024x1024';
const outputPath = process.argv[4] || `/tmp/dalle-${Date.now()}.png`;

if (!prompt) {
  console.log('Usage: node dalle-generate.js "<mo ta>" "[size]" "[output_path]"');
  console.log('Sizes: 1024x1024, 1792x1024 (ngang), 1024x1792 (dung)');
  process.exit(1);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.log('Loi: Thieu OPENAI_API_KEY');
  process.exit(1);
}

// Valid sizes for DALL-E 3
const VALID_SIZES = ['1024x1024', '1792x1024', '1024x1792'];
const finalSize = VALID_SIZES.includes(size) ? size : '1024x1024';

async function generate() {
  try {
    // Enhance prompt with STARDUCT brand guidelines
    const enhancedPrompt = `Professional, modern, clean design. ${prompt}.

BRAND GUIDELINES — STARDUCT by NSCA:
- Primary color: Orange (#F7941D) — energetic, bold, trust
- Secondary: Dark gray (#4A4A4A) — industrial, premium
- Accent: Black (#000000) — strong, confident
- Background: Clean white or light gray
- Style: Industrial-premium, modern HVAC manufacturing
- Slogan: "Trusted Performance"
- Products: Air grilles, fire dampers, mechanical dampers, VAV/CAV, cable trays
- Mood: Professional, reliable, high-tech manufacturing, Vietnamese pride
- Website: starduct.vn
- CRITICAL: NEVER render ANY text, letters, words, numbers, logos, watermarks, labels, or captions in the image. The image must be PURELY visual with ZERO text elements. This is mandatory — AI-generated text in Vietnamese is always garbled and unusable.`;

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: finalSize,
        quality: 'standard',
        response_format: 'b64_json'
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.log(`Loi DALL-E API: ${res.status} — ${err}`);
      process.exit(1);
    }

    const data = await res.json();

    if (data.data && data.data[0]) {
      const imageData = data.data[0].b64_json;
      const revisedPrompt = data.data[0].revised_prompt;

      // Save image to file
      const buffer = Buffer.from(imageData, 'base64');
      const dir = path.dirname(outputPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, buffer);

      const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);

      console.log(JSON.stringify({
        success: true,
        path: outputPath,
        size: finalSize,
        fileSizeMB: sizeMB,
        revisedPrompt: revisedPrompt,
        note: `Hinh da luu tai ${outputPath}. Dung --media de gui qua Zalo hoac dinh kem email.`
      }, null, 2));
    } else {
      console.log(JSON.stringify({ success: false, error: 'Khong tao duoc hinh', response: data }));
    }
  } catch (e) {
    console.log(`Loi: ${e.message}`);
    process.exit(1);
  }
}

generate();
