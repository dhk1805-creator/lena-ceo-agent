#!/usr/bin/env node
require('./_env');
// Content Generator — Le Na CEO Agent
// Viet bai dang Zalo OA theo template thu trong tuan (xoay vong 7 chu de).
//
// 7 chu de luan phien (gio Viet Nam, Asia/Ho_Chi_Minh):
//   T2: gioi thieu tinh nang san pham
//   T3: case study ung dung thuc te
//   T4: tips & tricks su dung
//   T5: so sanh STARDUCT voi doi thu (khach quan, khong che ai)
//   T6: tin tuc nganh / cong nghe HVAC
//   T7: review / phan hoi khach hang
//   CN: highlight tuan qua
//
// Usage: node content-generator.js "[productHint]" "[weekdayOverride]"
//   productHint   optional — goi y san pham/chu de cu the (e.g. "van EI chong chay")
//   weekdayOverride optional — 0..6 (CN=0, T2=1, ... T7=6) de test template thu khac
//
// Output JSON:
//   { success, weekday_num, weekday_label, topic, title, body }

const productHint = (process.argv[2] || '').trim();
const weekdayOverride = process.argv[3] ? parseInt(process.argv[3]) : null;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.log(JSON.stringify({ success: false, error: 'Thieu GEMINI_API_KEY' }));
  process.exit(1);
}

function vnWeekday() {
  const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return vnNow.getDay(); // 0=CN, 1=T2, ..., 6=T7
}

const WEEKDAY_LABELS = ['Chu Nhat', 'Thu 2', 'Thu 3', 'Thu 4', 'Thu 5', 'Thu 6', 'Thu 7'];

const HINT_LINE = productHint ? `Tap trung vao: ${productHint}.` : 'Tu chon 1 san pham cu the trong dai STARDUCT.';

const TEMPLATES = {
  1: {
    topic: 'Gioi thieu tinh nang san pham',
    prompt: `Viet 1 bai dang Zalo OA gioi thieu MOT tinh nang noi bat cua san pham STARDUCT (cua gio, van EI chong chay, van co khi, VAV/CAV, tam nan, thang mang cap). ${HINT_LINE}

Yeu cau:
- 150-200 tu tieng Viet chuyen nghiep, ro rang, hap dan
- Mo bai: van de khach hang gap phai
- Than bai: tinh nang giai quyet ra sao, lieu ich cu the
- Ket bai: keu goi tim hieu them tai starduct.vn
- TUYET DOI khong dung emoji

Format dau ra:
TITLE: <tieu de 1 dong, duoi 70 ky tu>
---
<body 3-4 doan>`
  },
  2: {
    topic: 'Case study ung dung thuc te',
    prompt: `Viet 1 bai dang Zalo OA ke 1 case study ung dung san pham STARDUCT trong du an HVAC thuc te (toa nha van phong, benh vien, nha xuong, trung tam thuong mai). ${HINT_LINE}

Yeu cau:
- 150-200 tu tieng Viet
- Co the moc tinh huong gia dinh (khong bia ten du an cu the)
- Neu loi ich do duoc bang con so neu hop ly (vd: tiet kiem nang luong %, giam tieng on dB)
- Lo ngoi NSCA/STARDUCT chia se, KHONG khoe khoang qua
- TUYET DOI khong dung emoji

Format dau ra:
TITLE: <tieu de 1 dong>
---
<body>`
  },
  3: {
    topic: 'Tips & tricks su dung',
    prompt: `Viet 1 bai dang Zalo OA chia se 3-5 tip thiet thuc khi lap dat / bao tri / chon mua thiet bi HVAC. ${HINT_LINE}

Yeu cau:
- 150-200 tu tieng Viet
- Tip cu the, ap dung duoc ngay
- Doc gia: ky su MEP, chu dau tu, nha thau
- Co the dung gach dau dong cho tung tip
- TUYET DOI khong dung emoji

Format dau ra:
TITLE: <tieu de 1 dong>
---
<body>`
  },
  4: {
    topic: 'So sanh STARDUCT voi doi thu (khach quan)',
    prompt: `Viet 1 bai dang Zalo OA so sanh san pham STARDUCT voi cac san pham tuong tu tren thi truong. ${HINT_LINE}

Yeu cau:
- 150-200 tu
- KHONG goi ten doi thu cu the, KHONG che bai san pham khac
- Nhan manh diem manh STARDUCT: Made in Vietnam, chat luong world-class, chung nhan UL/FM/AHRI/AAMA, gia hop ly, ho tro ky thuat tai cho
- Trung lap, khach quan
- TUYET DOI khong dung emoji

Format dau ra:
TITLE: <tieu de 1 dong>
---
<body>`
  },
  5: {
    topic: 'Tin tuc nganh / cong nghe HVAC',
    prompt: `Viet 1 bai dang Zalo OA chia se xu huong/cong nghe moi trong nganh HVAC (IoT, IAQ, chat luong khong khi, tiet kiem nang luong, tu dong hoa, BIM/MEP). ${HINT_LINE}

Yeu cau:
- 150-200 tu, mang tinh thoi su
- Dan dat tu nhin xu huong → san pham STARDUCT phu hop ra sao (nhe nhang, khong loi keu)
- Doc gia: chu dau tu, ky su, ban truong phong ky thuat
- TUYET DOI khong dung emoji

Format dau ra:
TITLE: <tieu de 1 dong>
---
<body>`
  },
  6: {
    topic: 'Review / phan hoi khach hang',
    prompt: `Viet 1 bai dang Zalo OA chia se phan hoi tich cuc tu khach hang/nha thau ve san pham STARDUCT. Lo ngoi NSCA chia se (KHONG quote nguyen van khach hang giay nhu). ${HINT_LINE}

Yeu cau:
- 150-180 tu, am ap, chuyen nghiep
- KHONG bia ten khach hang/du an cu the
- Nhan manh trai nghiem su dung, su dong hanh cua doi ngu NSCA
- TUYET DOI khong dung emoji

Format dau ra:
TITLE: <tieu de 1 dong>
---
<body>`
  },
  0: {
    topic: 'Highlight tuan qua',
    prompt: `Viet 1 bai dang Zalo OA tom luoc hoat dong noi bat cua STARDUCT/NSCA tuan vua qua (san pham, du an, su kien, tin nguoi). ${HINT_LINE}

Yeu cau:
- 150-180 tu, giong tich cuc, cam on doc gia da dong hanh
- Neu khong co data cu the → viet chung chung ve tien trinh nganh / doi ngu
- Ket bai chuc tuan moi tot dep, hen tuan toi
- TUYET DOI khong dung emoji

Format dau ra:
TITLE: <tieu de 1 dong>
---
<body>`
  }
};

function parseTitleBody(raw) {
  const m = raw.match(/^TITLE:\s*(.+?)\s*\r?\n\s*-{3,}\s*\r?\n([\s\S]+)$/);
  if (m) return { title: m[1].trim(), body: m[2].trim() };

  // Fallback: first non-empty line as title, rest as body
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { title: '', body: '' };
  const firstLine = lines[0].replace(/^(title|tieu de)\s*:\s*/i, '').trim();
  return { title: firstLine, body: lines.slice(1).join('\n').trim() || raw.trim() };
}

async function main() {
  const wd = weekdayOverride !== null && weekdayOverride >= 0 && weekdayOverride <= 6
    ? weekdayOverride
    : vnWeekday();
  const tpl = TEMPLATES[wd];

  const systemPrompt = `Ban la tro ly viet content marketing cho STARDUCT (Ngoi Sao Chau A JSC - NSCA).
- Nganh: san xuat HVAC (cua gio, van chong chay EI, van co khi, VAV/CAV, tam nan, thang mang cap)
- Slogan: "Trusted Performance" | Website: starduct.vn
- Chung nhan: UL, FM, AHRI, AAMA | Made in Vietnam, world-class quality
- Phong cach: chuyen nghiep, ngan gon, hap dan, KHONG dung emoji
- KHONG bia so lieu, KHONG noi xau doi thu, KHONG hua hen vuot kha nang`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: tpl.prompt }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.8 }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.log(JSON.stringify({ success: false, error: `Gemini API: ${res.status} — ${err}` }));
    process.exit(1);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  if (!raw) {
    console.log(JSON.stringify({ success: false, error: 'Gemini khong tra ve noi dung', raw: data }));
    process.exit(1);
  }

  const { title, body } = parseTitleBody(raw);
  if (!title || !body) {
    console.log(JSON.stringify({ success: false, error: 'Khong parse duoc title/body', raw }));
    process.exit(1);
  }

  console.log(JSON.stringify({
    success: true,
    weekday_num: wd,
    weekday_label: WEEKDAY_LABELS[wd],
    topic: tpl.topic,
    title,
    body,
    tokens: data.usageMetadata?.totalTokenCount || 'N/A',
    cost: 'FREE (Gemini Flash)'
  }, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
