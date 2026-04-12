# Sunday Meeting Prep — Tong hop bao cao tuan & Chuan bi hop giao ban Thu 2

## Trigger
- Cron job: Chu nhat 21:00 (tuan)
- Lenh: CEO goi "/hopgiaoban" hoac "/meeting"

## Muc dich
Tong hop bao cao tuan tu 14 bo phan, ket hop KPI va du lieu NPP, lap noi dung hop giao ban cho CEO vao sang Thu 2.

## Quy trinh

### Buoc 1: Xac dinh tuan hien tai
- Tinh week number cua nam (vi du: Tuan 15, Tuan 16)
- Xac dinh khoang thoi gian (Thu 2 → Chu nhat)

### Buoc 2: Quet email bao cao tuan
Chay: `node /app/google-tools/gmail-read.js 168 100`
- 168h = 7 ngay, toi da 100 email
- Loc email co chu de chua: 'bao cao', 'report', 'tuan', 'weekly', 'BC tuan'
- Nhan dien email tu 14 truong bo phan:
  1. R&D — anh Nam (namph@nsca.vn)
  2. HCNS — anh Son (sondv@nsca.vn)
  3. PKD — anh Ngoc (ndao@nsca.vn)
  4. BD Noi dia — anh Duc (ductm@nsca.vn)
  5. BD International — anh Santiago (santiago@nsca.vn)
  6. Back Office — chi Tam (tamntt@nsca.vn)
  7. TCKT — anh Duan (duannt@nsca.vn)
  8. GD Nha may / SX Nhom — anh Ngoc (ngocnv@nsca.vn)
  9. SX Thep — anh Tung (tunghm@nsca.vn)
  10. Co Dien — anh Phong (phongdv@nsca.vn)
  11. QAQC — anh Tuan (tuannl@nsca.vn)
  12. Kho — chi Ha (hant@nsca.vn)
  13. Giao Hang — anh Duc (ducvt@nsca.vn)
  14. Cung Ung — chi Kim Anh (anhdtk@nsca.vn)

### Buoc 3: Doc va phan tich tung bao cao
- Doc noi dung email (snippet + body)
- Tom tat thanh tich, van de, de xuat cua tung bo phan
- Rut ra dau viec can trien khai / thuc hien / hoan thanh

### Buoc 4: Doc du lieu bo sung tu Google Sheets
- `node /app/google-tools/sheets-read.js $GOOGLE_SHEET_ID "'2. KPI Tracker'!A1:Z100"`
- `node /app/google-tools/sheets-read.js $GOOGLE_SHEET_ID "'6. Report Tracker'!A1:S50"`
- `node /app/google-tools/sheets-read.js $GOOGLE_SHEET_ID "'10. NPP Tracker'!A1:S50"`

### Buoc 5: Lap tai lieu hop giao ban
Format noi dung:

```
NOI DUNG HOP GIAO BAN TUAN [XX]
Ngay hop: Thu 2, [ngay/thang/nam]
Chuan bi: Dao Thi Le Na — Tro ly AI CEO

1. TONG QUAN TUAN QUA
- Doanh thu tuan: [so lieu]
- So sanh voi ke hoach: [%]
- Diem noi bat: [3-5 diem chinh]

2. BAO CAO TUNG BO PHAN (14 BP)
[Ten bo phan] — [Truong BP]
- Ket qua chinh: [tom tat]
- Van de: [liet ke]
- Dau viec tuan toi:
  [ ] [Viec 1] — Deadline: [ngay] — Phu trach: [ten]
- Trang thai: xanh/vang/do

(Neu CHUA NOP bao cao → ghi ro: CHUA NOP BAO CAO)

3. KPI HIGHLIGHTS
- Top 3 KPI dat/vuot
- Top 3 KPI chua dat

4. TINH HINH NPP
- NTK: [%] KH
- GALAXY: [%] KH
- VNMEP: [%] KH
- IMP: [%] KH
- MEPCO: [%] KH

5. VAN DE CAN CEO QUYET DINH
1. [Van de 1] — De xuat: [giai phap]

6. DAU VIEC TUAN TOI
| # | Dau viec | Bo phan | Phu trach | Deadline | Uu tien |

7. LICH HOP TUAN MOI
(Doc tu Calendar)
```

### Buoc 6: Luu noi dung
- Tao Google Doc bang: `node /app/google-tools/gdoc-create.js "Noi dung hop giao ban tuan [XX]" "<noi dung>"`
- Nhan lai docUrl de gui cho CEO

### Buoc 7: Gui Zalo cho Sep Khanh
- Gui tom tat ngan (max 2000 ky tu) qua Zalo
- Noi: "Da, anh Khanh, em da chuan bi xong noi dung hop giao ban Tuan [XX]. [Tom tat 3-5 diem chinh]. Link tai lieu: [docUrl]"
- Neu co van de KHAN CAP → highlight dau tin nhan
