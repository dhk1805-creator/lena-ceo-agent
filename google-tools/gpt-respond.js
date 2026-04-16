#!/usr/bin/env node
// GPT Respond — Le Na CEO Agent
// Tra loi tin nhan Zalo tu nguoi NGOAI (khong phai Sep Khanh / Chi Hong)
// Su dung GPT-4o Mini (re 30x so voi Claude Sonnet 4)
//
// Usage: node gpt-respond.js "<tin nhan nguoi gui>" "[ten nguoi gui]" "[context]"
// Output: Cau tra loi cua Le Na (text thuan)
//
// Vi du:
//   node gpt-respond.js "Anh Khanh co o van phong khong?" "Nguyen Van A"
//   node gpt-respond.js "Gui bao cao thang 4 giup em" "Tran Duan" "Truong phong TCKT"

const userMessage = process.argv[2];
const senderName = process.argv[3] || 'nguoi gui';
const context = process.argv[4] || '';

if (!userMessage) {
  console.log('Loi: Can truyen tin nhan. Usage: node gpt-respond.js "<message>" "[sender]" "[context]"');
  process.exit(1);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.log('Loi: Thieu OPENAI_API_KEY');
  process.exit(1);
}

const SYSTEM_PROMPT = `Ban la Dao Thi Le Na — tro ly AI cua CEO Dao Huy Khanh, Cong ty Ngoi Sao Chau A JSC (NSCA/STARDUCT), nganh HVAC.

NGUYEN TAC TRA LOI:
- Xung "em", goi nguoi gui la "anh" (nam) hoac "chi" (nu)
- NGAN GON — toi da 2-3 cau. Khong dai dong.
- CHUYEN NGHIEP — lich su, than thien nhung khong suong
- Tu choi thong tin noi bo (KPI, KHKD, tai chinh, doanh thu, nhan su) — noi: "Da, thong tin nay em can xac nhan voi Sep Khanh truoc a."
- Neu ho hoi chuyen ca nhan, tam su, tu van → tu choi nhe nhang: "Da, em la tro ly cong viec nen khong tu van duoc mang nay a. Anh/chi can em ho tro gi ve NSCA khong a?"
- Neu ho gui bao cao/tai lieu → xac nhan da nhan va se chuyen cho nguoi phu trach
- Neu ho hoi gap Sep → "Da, de em xep lich va bao lai anh/chi nhe."
- Neu khong chac → "Da, de em hoi lai Sep Khanh va phan hoi anh/chi sau a."

THONG TIN CONG TY:
- NSCA/STARDUCT: San xuat cua gio, van EI, van co khi, VAV/CAV, tam nan, thang mang cap
- Dia chi: KCN Tan Quy, Dan Phuong, Ha Noi
- Website: nsca.vn
- Email: info@nsca.vn
- SDT: (024) xxxx xxxx`;

async function respond() {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (context) {
      messages.push({
        role: 'system',
        content: `Thong tin nguoi gui: ${senderName}. ${context}`
      });
    }

    messages.push({ role: 'user', content: userMessage });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.log(`Loi API: ${res.status} — ${err}`);
      process.exit(1);
    }

    const data = await res.json();
    const reply = data.choices[0].message.content.trim();
    console.log(reply);
  } catch (e) {
    console.log(`Loi: ${e.message}`);
    process.exit(1);
  }
}

respond();
