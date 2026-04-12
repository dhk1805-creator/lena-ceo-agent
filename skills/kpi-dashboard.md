# Skill: KPI Dashboard
# Lenh: /kpi
# Trigger: CEO gui "/kpi", "KPI", "chi so"

## Muc dich
Hien thi KPI tong hop cua NSCA/STARDUCT theo thang hien tai.

## Steps

### 1. Thu thap du lieu
Doc tu Google Sheets:
- "KPI Tracker" (sheet #2) — KPI chinh
- "KHKD 2026 Baseline" (sheet #9) — Ke hoach
- "NPP Tracker" (sheet #10) — Doanh thu NPP
- "Export Revenue Tracker" (sheet #15) — Xuat khau

### 2. Tinh toan KPI

| KPI | Cong thuc | Don vi |
|-----|-----------|--------|
| Doanh thu thang | Tong don hang xuat trong thang | ty VND |
| % Dat KH thang | Doanh thu thuc te / KHKD thang | % |
| Doanh thu luy ke | Tong tu dau nam | ty VND |
| % Dat KH luy ke | Luy ke thuc te / Luy ke KH | % |
| Don hang moi | So don ky moi trong thang | don |
| Gia tri don moi | Tong gia tri don moi | ty VND |
| Cong no phai thu | Tong cong no chua thu | ty VND |
| DSO | Cong no / (Doanh thu/30) | ngay |
| Ty le giao hang dung han | Don giao dung / Tong don | % |
| Ty le loi san pham | SP loi / Tong SP | % |
| San luong Nhom | Tong SP nhom | cai |
| San luong Thep | Tong SP thep | cai |

### 3. Traffic light rating

| Emoji | Dieu kien |
|-------|-----------|
| GREEN_CIRCLE Xanh | >= 100% ke hoach |
| YELLOW_CIRCLE Vang | >= 80% ke hoach |
| RED_CIRCLE Do | < 80% ke hoach |

### 4. Format tra loi

```
CHART_INCREASING KPI DASHBOARD — Thang [X]/2026
Cap nhat: [ngay gio]

=== DOANH THU ===
[EMOJI] Thang nay: [so] ty / KH [so] ty ([%])
[EMOJI] Luy ke: [so] ty / KH [so] ty ([%])
Tong KH nam 2026: 251.7 ty VND

=== KINH DOANH ===
[EMOJI] Don hang moi: [so] don | [so] ty VND
[EMOJI] Cong no phai thu: [so] ty | DSO: [so] ngay
Pipeline: [so] ty (du kien ky thang toi)

=== SAN XUAT ===
[EMOJI] Nhom: [so] SP | Cong suat: [%]
[EMOJI] Thep: [so] SP | Cong suat: [%]
[EMOJI] Ty le loi: [%]
[EMOJI] Giao hang dung han: [%]

=== NPP NOI DIA ===
| NPP | Doanh thu | KH | Dat |
|-----|-----------|-----|-----|
| NTK (Hang A) | [so] ty | [so] ty | [EMOJI] [%] |
| Galaxy (Hang B) | [so] ty | [so] ty | [EMOJI] [%] |
| VNMEP (Hang B) | [so] ty | [so] ty | [EMOJI] [%] |
| IMP (Hang C) | [so] ty | [so] ty | [EMOJI] [%] |
| MEPCO (Hang C) | [so] ty | [so] ty | [EMOJI] [%] |

=== XUAT KHAU (Santiago) ===
Pipeline: $[so]K | Closed: $[so]K
Target Y1: $300K | Dat: [%]

=== CLIMANEXUS ===
Pre-seed: $[so]K / $500K target
Milestone: [trang thai hien tai]

POINT_RIGHT Top 3 van de can xu ly:
1. [Van de 1]
2. [Van de 2]
3. [Van de 3]
```

## Luu y
- So lieu phai CHINH XAC tu Google Sheets, khong duoc uoc tinh
- Neu chua co du lieu thang hien tai: lay thang gan nhat + ghi chu
- So sanh voi thang truoc (MoM) va cung ky nam truoc (YoY) neu co
- Chia tin nhan Zalo neu qua 2000 ky tu
