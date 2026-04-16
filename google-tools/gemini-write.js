#!/usr/bin/env node
// Gemini Write — Le Na CEO Agent
// Dung Gemini 2.0 Flash (MIEN PHI) de viet noi dung dai
// Email, bao cao, content marketing, blog, quang cao...
//
// Usage: node gemini-write.js "<prompt>" "[maxTokens]"
//
// Examples:
//   node gemini-write.js "Viet email nhac 14 truong phong nop bao cao tuan"
//   node gemini-write.js "Viet bao cao tong hop KPI thang 4/2026 tu du lieu: [data]" 2000
//   node gemini-write.js "Viet bai dang Facebook gioi thieu cua gio STARDUCT"
//   node gemini-write.js "Viet email tieng Anh cho doi tac OEM ve san pham VAV Box"

const prompt = process.argv[2];
const maxTokens = parseInt(process.argv[3] || '1500');

if (!prompt) {
  console.log('Usage: node gemini-write.js "<prompt>" "[maxTokens]"');
  process.exit(1);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.log(JSON.stringify({ error: 'Thieu GEMINI_API_KEY' }));
  process.exit(1);
}

async function main() {
  try {
    const systemPrompt = `Ban la tro ly viet noi dung chuyen nghiep cho cong ty NSCA / thuong hieu STARDUCT.

THONG TIN CONG TY:
- Ten: Ngoi Sao Chau A JSC (NSCA)
- Thuong hieu: STARDUCT
- Nganh: San xuat HVAC (cua gio, van chong chay EI, van co khi, VAV/CAV, tam nan, thang mang cap)
- CEO: Dao Huy Khanh
- Website: starduct.vn
- Slogan: "Trusted Performance"
- Gia tri: Made in Vietnam, World-class Quality
- Chung nhan: UL, FM, AHRI, AAMA
- 5 NPP: NTK, GALAXY, VNMEP, IMP, MEPCO
- Cong ty con: ClimaNexus (IAQ/IEQ startup)

QUY TAC VIET:
- Viet chinh xac, chuyen nghiep, khong sai chinh ta
- Dung tieng Viet hoac tieng Anh tuy yeu cau
- Viet dung phong cach doanh nghiep, khong suong sa
- Khi viet email: xung "em" (Le Na), goi "anh/chi" tuy gioi tinh nguoi nhan
- Khi viet marketing: nhan manh chat luong, cong nghe, uy tin STARDUCT
- Khi viet bao cao: co so lieu, ngan gon, co de xuat hanh dong`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7
          }
        })
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.log(JSON.stringify({ error: `Gemini API: ${res.status} — ${err}` }));
      process.exit(1);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!content) {
      console.log(JSON.stringify({ error: 'Gemini khong tra ve noi dung', raw: data }));
      process.exit(1);
    }

    console.log(JSON.stringify({
      success: true,
      content: content,
      tokens: data.usageMetadata?.totalTokenCount || 'N/A',
      cost: 'FREE (Gemini Flash)',
      note: 'Noi dung do Gemini viet. Le Na doc lai, chinh sua neu can, roi gui.'
    }, null, 2));

  } catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
}

main();
