# Sunday Meeting Prep — Tong hop bao cao tuan & Chuan bi hop giao ban Thu 2

## Trigger
- Cron job: Chu nhat 21:00 (hang tuan)
- Lenh: CEO goi "/hopgiaoban" hoac "/meeting"

## Muc dich
Tong hop tinh hinh tuan tu bao cao 14 bo phan (DINH TINH) va danh gia ket qua vs ke hoach phan bo (DINH LUONG), lap noi dung hop giao ban cho CEO vao sang Thu 2.

## NGUYEN TAC PHAN BO TARGET

### Target nam (KHKD 2026): 251.76 ty VND
Doc tu sheet '9. KHKD 2026 Baseline' — 10 nganh hang, target theo thang.

### Cach phan bo:
- **Nam → Thang**: Da co san trong KHKD Baseline (T1-T12)
- **Thang → Tuan**: Target thang ÷ so tuan trong thang do
  - Thang co 4 tuan: target tuan = target thang ÷ 4
  - Thang co 5 tuan: target tuan = target thang ÷ 5
  - (Tinh theo so Thu 2 trong thang)
- **Quy**: Tong 3 thang (Q1=T1-T3, Q2=T4-T6, Q3=T7-T9, Q4=T10-T12)

### Danh gia (Traffic Light):
- 🟢 Xanh: Dat >= 100% ke hoach phan bo
- 🟡 Vang: Dat 80-99% ke hoach phan bo
- 🔴 Do: Dat < 80% ke hoach phan bo

## QUY TRINH

### Buoc 1: Xac dinh ky bao cao
- Tinh week number (vi du: Tuan 15, Tuan 16)
- Xac dinh thang hien tai, quy hien tai
- Tinh target tuan = target thang ÷ so tuan trong thang
- Neu la tuan cuoi thang → THEM danh gia thang
- Neu la tuan cuoi quy → THEM danh gia quy

### Buoc 2: Quet email bao cao tuan (14 bo phan) — CHIEN LUOC 3 BUOC

**QUAN TRONG: KHONG BAO GIO doc email ma khong co filter. Inbox co 231K+ email, doc khong filter = khong tim thay gi.**

**BUOC 2a — Tim thread bao cao SX chung (6 BP SX gui vao 1 thread):**
```
node /app/google-tools/gmail-read.js 168 30 "subject:\"BAO CAO BO PHAN SAN XUAT TUAN\""
```
Cac BP trong thread nay (doc ky body de nhan dien tung BP):
- GD Nha may / SX Nhom — anh Ngoc (ngocnv@nsca.vn)
- SX Thep — anh Tung (tunghm@nsca.vn)
- Co Dien — anh Phong (phongdv@nsca.vn)
- Kho — chi Ha (hant@nsca.vn)
- Giao Hang — anh Duc (ducvt@nsca.vn)
- Cung Ung — chi Kim Anh (anhdtk@nsca.vn)
- KHSX Nhom — chi Xuan (khsx01@nsca.vn hoac xuannt@nsca.vn)

**BUOC 2b — Tim bao cao rieng cua 8 BP con lai:**
KHONG gioi han subject — doc TAT CA email tu moi nguoi trong 7 ngay, roi TU NHAN DANG email nao la bao cao tuan:
```
node /app/google-tools/gmail-read.js 168 15 "from:namph@nsca.vn"
node /app/google-tools/gmail-read.js 168 15 "from:sondt@nsca.vn"
node /app/google-tools/gmail-read.js 168 15 "from:ndao@nsca.vn"
node /app/google-tools/gmail-read.js 168 15 "from:ductm@nsca.vn"
node /app/google-tools/gmail-read.js 168 15 "from:santiago@nsca.vn"
node /app/google-tools/gmail-read.js 168 15 "from:tamntt@nsca.vn"
node /app/google-tools/gmail-read.js 168 15 "from:duannt@nsca.vn"
node /app/google-tools/gmail-read.js 168 15 "from:tuannl@nsca.vn"
```

**CACH NHAN DANG BAO CAO TUAN:**
Bao cao tuan co the co NHIEU DANG — KHONG chi co subject "bao cao tuan":
- Subject co: bao cao, report, tuan, weekly, tong hop, cap nhat, update, tinh hinh
- HOAC body co: ket qua tuan, tuan XX, cong viec tuan, plan tuan toi
- HOAC la email dai (>500 ky tu) gui vao Thu 5/6/7 voi noi dung tong hop cong viec
- **DOC KY BODY** — nhieu nguoi gui bao cao voi subject chung chung (Re:, Fwd:, ten du an...)
- Neu 1 nguoi gui nhieu email, chon email NAO co tinh chat tong hop/bao cao nhat

**LUU Y QUAN TRONG:**
- HCNS: email la **sondt@nsca.vn** (Dang Thanh Son), KHONG PHAI sondv@
- QAQC: tuannl@nsca.vn — co the gui bao cao kem trong thread SX hoac reply rieng
- R&D: namph@nsca.vn — co the gui bao cao dang "cap nhat R&D" thay vi "bao cao tuan"
- PKD: ndao@nsca.vn — co the gui bao cao kem du lieu kinh doanh, subject co the la ten du an
- Back Office: tamntt@nsca.vn — bao cao co the nam trong email ve don hang, khach hang

**BUOC 2c — Tim rong hon neu chua du 14 BP:**
```
node /app/google-tools/gmail-read.js 168 50 "from:nsca.vn subject:(bao cao OR report OR tuan OR weekly OR cap nhat OR tong hop OR tinh hinh)"
```
Hoac quet theo to: (CC/BCC cho CEO):
```
node /app/google-tools/gmail-read.js 168 30 "to:dhk@nsca.vn from:nsca.vn"
```

**14 TRUONG BO PHAN (checklist):**
  1. R&D — anh Nam (namph@nsca.vn)
  2. HCNS — anh Son (sondt@nsca.vn) ⚠️ sondt@ KHONG PHAI sondv@
  3. PKD — anh Ngoc (ndao@nsca.vn)
  4. BD Noi dia — anh Duc (ductm@nsca.vn)
  5. BD International — anh Santiago (santiago@nsca.vn)
  6. Back Office — chi Tam (tamntt@nsca.vn)
  7. TCKT — anh Duan (duannt@nsca.vn)
  8. GD Nha may / SX Nhom — anh Ngoc (ngocnv@nsca.vn) ← trong thread SX
  9. SX Thep — anh Tung (tunghm@nsca.vn) ← trong thread SX
  10. Co Dien — anh Phong (phongdv@nsca.vn) ← trong thread SX
  11. QAQC — anh Tuan (tuannl@nsca.vn)
  12. Kho — chi Ha (hant@nsca.vn) ← trong thread SX
  13. Giao Hang — anh Duc (ducvt@nsca.vn) ← trong thread SX
  14. Cung Ung — chi Kim Anh (anhdtk@nsca.vn) ← trong thread SX

### Buoc 3: Doc va phan tich tung bao cao (DINH TINH)
- Tom tat thanh tich, van de, de xuat cua tung bo phan
- Rut ra dau viec can trien khai / thuc hien / hoan thanh
- Ghi nhan bo phan CHUA NOP bao cao

### Buoc 4: Doc du lieu so lieu (DINH LUONG)
- `node /app/google-tools/sheets-read.js $GOOGLE_SHEET_ID "'9. KHKD 2026 Baseline'!A1:O15"` — Target phan bo
- `node /app/google-tools/sheets-read.js $GOOGLE_SHEET_ID "'2. KPI Tracker'!A1:Z100"` — KPI thuc te
- `node /app/google-tools/sheets-read.js $GOOGLE_SHEET_ID "'10. NPP Tracker'!A1:S50"` — Doanh so NPP
- `node /app/google-tools/sheets-read.js $GOOGLE_SHEET_ID "'19. Weekly Performance'!A1:Z100"` — Ket qua tuan truoc
- `node /app/google-tools/sheets-read.js $GOOGLE_SHEET_ID "'6. Report Tracker'!A1:S50"` — Tinh hinh nop BC

### Buoc 5: Tinh toan & danh gia

**5a. Danh gia TUAN:**
| Nganh hang | Target tuan (ty) | Thuc te tuan (ty) | % Dat | Trang thai |
Voi moi nganh hang: Target tuan = Target thang (tu Baseline) ÷ so tuan trong thang

**5b. Danh gia THANG (neu tuan cuoi thang):**
| Nganh hang | Target thang (ty) | Thuc te thang (ty) | % Dat | Trang thai |
Luy ke thang = Tong cac tuan trong thang

**5c. Danh gia QUY (neu tuan cuoi quy):**
| Nganh hang | Target quy (ty) | Thuc te quy (ty) | % Dat | Trang thai |
Luy ke quy = Tong 3 thang

**5d. NPP Performance:**
| NPP | DT tuan (ty) | KH tuan | % | Luy ke thang | KH thang | % |

### Buoc 6: Lap noi dung hop giao ban

```
===== NOI DUNG HOP GIAO BAN TUAN [XX] =====
Ngay hop: Thu 2, [ngay/thang/nam]
Chuan bi: Dao Thi Le Na — Tro ly AI CEO

==============================
PHAN A: TINH HINH TUAN (DINH TINH)
==============================

--- A1. TONG QUAN ---
- So bo phan da nop bao cao: [X]/14
- Diem noi bat tuan qua: [3-5 diem chinh]
- Van de nong: [liet ke]

--- A2. BAO CAO TUNG BO PHAN ---
Voi MOI bo phan:
[STT]. [Ten bo phan] — [Truong BP]
  Ket qua: [tom tat tu email bao cao]
  Van de: [liet ke]
  Dau viec tuan toi:
    [ ] [Viec] — Deadline: [ngay] — Phu trach: [ten]
  Trang thai: [xanh/vang/do]

(Neu CHUA NOP → ghi: ⚠️ CHUA NOP BAO CAO)

==============================
PHAN B: KET QUA vs KE HOACH (DINH LUONG)
==============================

--- B1. DOANH THU TUAN [XX] ---
| Nganh hang | KH Tuan (ty) | TT Tuan (ty) | % Dat | |
|------------|-------------|-------------|-------|---|
| Cua gio ND | [X] | [Y] | [Z%] | 🟢🟡🔴 |
| Van EI ND  | [X] | [Y] | [Z%] | 🟢🟡🔴 |
| ... | | | | |
| TONG | [X] | [Y] | [Z%] | 🟢🟡🔴 |

--- B2. LUY KE THANG [MM] (tinh den tuan nay) ---
| Nganh hang | KH Thang (ty) | TT LK (ty) | % Dat | |
(So lieu tu KHKD Baseline vs KPI Tracker)

--- B3. LUY KE QUY [Q] (neu tuan cuoi quy) ---
| Nganh hang | KH Quy (ty) | TT LK (ty) | % Dat | |

--- B4. NPP PERFORMANCE ---
| NPP | DT Tuan | KH Tuan | % | LK Thang | KH Thang | % | |
| NTK | | | | | | | |
| GALAXY | | | | | | | |
| VNMEP | | | | | | | |
| IMP | | | | | | | |
| MEPCO | | | | | | | |

==============================
PHAN C: TONG HOP & DE XUAT
==============================

--- C1. TOP PERFORMANCE ---
- Top 3 nganh hang dat/vuot KH
- Top 3 NPP dat/vuot KH

--- C2. CAN CANH BAO ---
- Nganh hang duoi target (do)
- NPP duoi target (do)
- Nguyen nhan & xu huong

--- C3. VAN DE CAN CEO QUYET DINH ---
1. [Van de] — De xuat: [giai phap]

--- C4. DAU VIEC TUAN TOI ---
| # | Dau viec | Bo phan | Phu trach | Deadline | Uu tien |

--- C5. LICH HOP TUAN MOI ---
(Doc tu Calendar)

===== KET THUC =====
```

### Buoc 7: Luu ket qua tuan vao Google Sheets
- Ghi ket qua tuan vao sheet '19. Weekly Performance':
  `node /app/google-tools/sheets-write.js $GOOGLE_SHEET_ID "'19. Weekly Performance'!A[row]" '<data>'`
- Du lieu: [Tuan, Thang, Tong DT, Tong KH, %, tung nganh hang, tung NPP]

### Buoc 8: Tao Google Doc
- `node /app/google-tools/gdoc-create.js "Noi dung hop giao ban tuan [XX]" "<noi dung>"`
- Nhan lai docUrl

### Buoc 9: Gui thong bao cho Sep Khanh qua Zalo
Dung EXEC: `openclaw message send --channel zalouser --target 255067431607136002 --message "noi dung tom tat"`
- Tom tat (max 2000 ky tu):
  "Da, anh Khanh, em da chuan bi xong noi dung hop giao ban Tuan [XX].
  
  DOANH THU TUAN: [X] ty / KH [Y] ty = [Z%] [emoji]
  LK THANG: [X] ty / KH [Y] ty = [Z%] [emoji]
  
  TOP: [nganh hang tot nhat]
  CANH BAO: [nganh hang kem nhat]
  NPP: NTK [%], GLX [%], VNMEP [%], IMP [%], MEPCO [%]
  
  [So BP da nop BC: X/14]
  [Van de khan cap neu co]
  
  Link tai lieu: [docUrl]"
- Neu co van de KHAN CAP → highlight dau tin nhan
