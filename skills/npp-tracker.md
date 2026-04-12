# Skill: NPP Tracker
# Lenh: /npp
# Trigger: CEO gui "/npp", "nha phan phoi", "NPP"

## Muc dich
Theo doi tien do doanh thu va hieu qua cua 5 Nha Phan Phoi noi dia.

## Du lieu tham chieu — 5 NPP

| Code | NPP | Hang | Khu vuc | Email Admin | Email Sale |
|------|-----|------|---------|-------------|------------|
| NPP01 | NTK | Hang A | Mien Bac | npp01@partner.nsca.vn | npp01s@partner.nsca.vn |
| NPP02 | GALAXY | Hang B | Mien Trung | npp02@partner.nsca.vn | npp02s@partner.nsca.vn |
| NPP03 | VNMEP | Hang B | Mien Nam | npp03@partner.nsca.vn | npp03s@partner.nsca.vn |
| NPP04 | IMP | Hang C | TP.HCM | npp04@partner.nsca.vn | npp04s@partner.nsca.vn |
| NPP05 | MEPCO | Hang C | Binh Duong | npp05@partner.nsca.vn | npp05s@partner.nsca.vn |

## Steps

### 1. Thu thap du lieu
Doc tu Google Sheets:
- "NPP Tracker" (sheet #10) — Doanh thu 5 NPP x 12 thang
- "KPI Tracker" (sheet #2) — KPI chung

### 2. Tinh toan chi so tung NPP

| Chi so | Mo ta |
|--------|-------|
| Doanh thu thang | Tong don hang xuat cho NPP trong thang |
| % Dat KH | Thuc te / Ke hoach thang |
| Doanh thu luy ke | Tu dau nam |
| % Tang truong | So voi cung ky nam truoc (neu co) |
| Cong no | So tien NPP con no |
| Ngay no trung binh | DSO cua NPP |
| Top 3 san pham | San pham ban chay nhat |

### 3. Xep hang NPP

| Hang | Tieu chi | Quyen loi |
|------|----------|-----------|
| Hang A | DT >= [nguong A] | Chiet khau cao, uu tien hang |
| Hang B | DT >= [nguong B] | Chiet khau trung binh |
| Hang C | DT < [nguong B] | Chiet khau co ban |

### 4. Format tra loi

```
DEPARTMENT_STORE NPP TRACKER — Thang [X]/2026
Cap nhat: [ngay]

=== TONG QUAN 5 NPP ===
Tong DT thang: [so] ty | KH: [so] ty | Dat: [EMOJI] [%]
Tong luy ke: [so] ty

=== CHI TIET ===

TROPHY NTK (Hang A — Mien Bac):
[EMOJI] DT thang: [so] ty / KH [so] ty = [%]
Luy ke: [so] ty | Cong no: [so] ty | DSO: [so] ngay
Top SP: [1], [2], [3]

2_CIRCLE GALAXY (Hang B — Mien Trung):
[EMOJI] DT thang: [so] ty / KH [so] ty = [%]
Luy ke: [so] ty | Cong no: [so] ty | DSO: [so] ngay
Top SP: [1], [2], [3]

3_CIRCLE VNMEP (Hang B — Mien Nam):
[EMOJI] DT thang: [so] ty / KH [so] ty = [%]
Luy ke: [so] ty | Cong no: [so] ty | DSO: [so] ngay
Top SP: [1], [2], [3]

4_CIRCLE IMP (Hang C — TP.HCM):
[EMOJI] DT thang: [so] ty / KH [so] ty = [%]
Luy ke: [so] ty | Cong no: [so] ty | DSO: [so] ngay

5_CIRCLE MEPCO (Hang C — Binh Duong):
[EMOJI] DT thang: [so] ty / KH [so] ty = [%]
Luy ke: [so] ty | Cong no: [so] ty | DSO: [so] ngay

=== CANH BAO ===
RED_CIRCLE Cong no qua han: [NPP] — [so] ty — [so] ngay qua han
RED_CIRCLE Giam DT: [NPP] — Giam [%] so thang truoc
YELLOW_CIRCLE Can ho tro: [NPP] — [ly do]

=== DE XUAT ===
1. [Action cu the cho NPP nao]
2. [Action cu the]
```

## Luu y
- NTK la NPP lon nhat (Hang A) — luon dat dau danh sach
- Cong no qua han > 60 ngay → canh bao RED_CIRCLE
- Neu NPP giam hang lien tiep 2 thang → de xuat gap CEO + NPP
- Phu trach NPP: anh Ngoc PKD (ndao@nsca.vn) va anh Duc BD (ductm@nsca.vn)
