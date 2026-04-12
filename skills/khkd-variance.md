# Skill: KHKD 2026 Variance Analysis
# Lenh: /khkd
# Trigger: CEO gui "/khkd", "ke hoach kinh doanh", "variance"

## Muc dich
Phan tich chenh lech giua Ke Hoach Kinh Doanh 2026 va thuc te theo 10 nganh hang x 12 thang.

## Du lieu tham chieu — KHKD 2026 Baseline (251.7 ty VND)

| # | Nganh hang | KH Nam (ty) | Binh quan thang (ty) |
|---|-----------|-------------|----------------------|
| 1 | Cua gio noi dia | 48.08 | 4.01 |
| 2 | Van EI noi dia | 90.96 | 7.58 |
| 3 | Van co khi noi dia | 30.03 | 2.50 |
| 4 | VAV/CAV | 17.28 | 1.44 |
| 5 | Tam nan sot trung | 18.40 | 1.53 |
| 6 | Cua gio xuat khau | 27.70 | 2.31 |
| 7 | Van EI xuat khau | 10.45 | 0.87 |
| 8 | Van co khi xuat khau | 4.70 | 0.39 |
| 9 | Thang mang cap | 0 | 0 |
| 10 | Hang hoa khac | 4.16 | 0.35 |
| **TONG** | | **251.76** | **20.98** |

## Steps

### 1. Thu thap du lieu
Doc tu Google Sheets:
- "KHKD 2026 Baseline" (sheet #9) — Ke hoach chi tiet 10 nganh x 12 thang
- "Variance Log" (sheet #11) — Lich su variance
- "KPI Tracker" (sheet #2) — Thuc te

### 2. Tinh variance tung nganh hang

```
Variance = Thuc te - Ke hoach
Variance % = (Thuc te / Ke hoach - 1) x 100%
```

### 3. Phan loai variance

| Muc | Dieu kien | Hanh dong |
|-----|-----------|-----------|
| GREEN_CIRCLE On track | Variance >= 0% | Duy tri |
| YELLOW_CIRCLE Canh bao | -20% <= Variance < 0% | Can theo doi |
| RED_CIRCLE Bao dong | Variance < -20% | Can hanh dong ngay |
| STAR Vuot ke hoach | Variance > +10% | Khen thuong/tang KH |

### 4. Format tra loi

```
TARGET KHKD 2026 — Variance Analysis
Thang [X]/2026 | Cap nhat: [ngay]

=== TONG QUAN ===
KH thang: [so] ty | Thuc te: [so] ty | Variance: [+/-so] ty ([+/-%])
KH luy ke: [so] ty | Thuc te: [so] ty | Variance: [+/-so] ty ([+/-%])
KH ca nam: 251.7 ty

=== CHI TIET 10 NGANH HANG ===

NOI DIA (6 nganh):
[EMOJI] Cua gio: [TT] / [KH] ty = [%] | Var: [+/-so] ty
[EMOJI] Van EI: [TT] / [KH] ty = [%] | Var: [+/-so] ty
[EMOJI] Van co khi: [TT] / [KH] ty = [%] | Var: [+/-so] ty
[EMOJI] VAV/CAV: [TT] / [KH] ty = [%] | Var: [+/-so] ty
[EMOJI] Tam nan: [TT] / [KH] ty = [%] | Var: [+/-so] ty

XUAT KHAU (3 nganh):
[EMOJI] CG XK: [TT] / [KH] ty = [%] | Var: [+/-so] ty
[EMOJI] VEI XK: [TT] / [KH] ty = [%] | Var: [+/-so] ty
[EMOJI] VCK XK: [TT] / [KH] ty = [%] | Var: [+/-so] ty

KHAC:
[EMOJI] Hang hoa khac: [TT] / [KH] ty = [%]

=== XU HUONG (3 thang gan nhat) ===
Thang [X-2]: [so] ty
Thang [X-1]: [so] ty
Thang [X]: [so] ty
Trend: [tang/giam/on dinh]

=== DE XUAT ===
RED_CIRCLE Nganh can cuu:
1. [Nganh] — Thieu [so] ty — Nguyen nhan: [...]
   POINT_RIGHT Action: [de xuat cu the]

STAR Nganh vuot KH:
1. [Nganh] — Vuot [so] ty
   POINT_RIGHT Co the bu dap cho nganh yeu
```

### 5. Luu variance
Ghi vao Google Sheets "Variance Log" (sheet #11):
- Ngay phan tich
- Variance tung nganh
- Ghi chu nguyen nhan (neu CEO cung cap)

## Luu y
- Van EI noi dia la nganh CHINH (90.96 ty = 36% tong KH) — luon phan tich ky
- Xuat khau dang day manh — theo doi sat pipeline Santiago
- Thang mang cap KH = 0 nhung neu co doanh thu → bao cao nhu bonus
- So sanh YoY neu co du lieu nam truoc
