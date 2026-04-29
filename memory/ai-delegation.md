# AI DELEGATION — TOI UU CHI PHI (CHI TIET)

## BANG GIA (per 1M tokens):
| AI | Input | Output | Chi phi tuong doi |
|---|---|---|---|
| **Gemini 2.0 Flash** | FREE* | FREE* | 0x (mien phi 1500 req/ngay) |
| **GPT-4o Mini** | $0.15 | $0.60 | 1x (re nhat) |
| **Claude Haiku 4.5** | $1.00 | $5.00 | ~7x dat hon GPT |
| **Claude Sonnet 4** | $3.00 | $15.00 | ~50x dat hon GPT |

*Gemini free tier: 1500 requests/ngay + 1M tokens/ngay. Vuot moi tinh phi $0.075/$0.30.

## MA TRAN PHAN CONG:

### 🆓 GEMINI FLASH — DUNG NHIEU NHAT (40-50% workload)
- ✅ Viet email DAI (>200 ky tu) → `node /app/google-tools/gemini-write.js "<prompt>" [maxTokens]`
- ✅ Viet bao cao tuan/thang/quy
- ✅ Tom tat 11 bao cao tuan thanh 1 bao cao hop
- ✅ Phan tich variance, tinh % dat target
- ✅ Tao content marketing, blog, Facebook post
- ✅ Doc + tom tat file PDF/anh → `gemini-analyze.js "<file>" "<prompt>"`
- ✅ Dich tai lieu (Vi ↔ En)
- ✅ So sanh, doi chieu, phan tich data

### 💰 GPT-4O MINI — RE NHAT (10% workload)
- ✅ Tra loi Zalo NON-VIP TIENG ANH (Santiago, OEM partner) → `node /app/google-tools/gpt-respond.js "<msg>" "<sender>" "<context>"`
- ✅ Phan loai email NHANH (urgent/normal/spam)
- ✅ Tom tat NGAN 1-2 cau

### 🧠 CLAUDE HAIKU 4.5 — RE HON SONNET 3X (30-40% workload)
- ✅ Tra loi Zalo non-VIP **TIENG VIET** (chat luong tot hon GPT-4o Mini)
- ✅ Doc + phan loai email tieng Viet
- ✅ Cron job EXECUTE (sau khi Sonnet plan)
- ✅ Backup khi Gemini fail
- ✅ Soan email TIENG VIET TRANG TRONG (kinh chao Sep, voan phong)
- ✅ Phan tich nhe co tool use: doc sheet, viet sheet
- Lenh: dat `--model anthropic/claude-haiku-4-5-20251001`

### 👑 CLAUDE SONNET 4 — DAT NHAT (5-10% workload, CHI VIP)
- ✅ Tra loi VIP truc tiep (Sep Khanh, Chi Hong) tren Dashboard/Zalo
- ✅ Quyet dinh STRATEGIC nhay cam
- ✅ Tom tat cuoi cung 1 tin Zalo cho Sep (chat luong cao)

## QUY TRINH MAU — VIET EMAIL CHO 11 BP (T2 8h):
1. Le Na (Sonnet) doc bien ban hop + bao cao tuan
2. **VOI MOI BP (lap 11 lan):**
   - Sonnet → giao Gemini soan email phan tich (8000 tokens, mien phi)
   - Sonnet → goi gmail-send.js de gui (chi 1 lenh)
3. Sonnet giao Gemini tong hop bao cao Sep
4. Sonnet → goi gdoc-create.js + gmail-send.js + Zalo send
5. Sonnet ket thuc voi 1 tin Zalo TOM TAT (max 200 ky tu)

**Tong cost:** 11 lan Gemini (~$0) + 11 + 2 lenh tool = chi ton tokens cho buoc dieu phoi.

## CAM:
- ❌ KHONG dung Sonnet de viet email dai >200 ky tu (giao Gemini)
- ❌ KHONG dung Sonnet de tra loi Zalo non-VIP (giao Haiku/GPT)
- ❌ KHONG dung Sonnet de phan tich file lon (giao Gemini)
- ❌ KHONG dung Sonnet de dich tai lieu (giao Gemini)
- ❌ KHONG goi Sonnet lai 5-10 lan trong 1 task (planning 1 lan, thuc thi nhanh)

## MUC TIEU CHI PHI:
- Sonnet 4: <$0.50/ngay
- Haiku 4.5: <$0.30/ngay
- GPT-4o Mini: <$0.05/ngay
- Gemini Flash: $0/ngay
- **TONG: <$0.85/ngay = ~$25/thang**

## RULE OF THUMB — KHI NAO DUNG MODEL NAO:
1. **Co toolcall + tieng Viet trang trong + >3 buoc** → Sonnet plan, Haiku execute
2. **Content dai (>200 ky tu)** → Gemini (free)
3. **Tin ngan + tieng Viet** → Haiku
4. **Tin ngan + tieng Anh / phan loai don gian** → GPT-4o Mini
5. **VIP truc tiep hoi** → Sonnet 4 (em chao Sep ngan gon)
6. **Cron job lap di lap lai** → Haiku (KHONG Sonnet, phi tien)
