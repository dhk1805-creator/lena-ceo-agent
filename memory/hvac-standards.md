# HVAC Standards — STARDUCT Product Spec

Tieu chuan SAN PHAM theo dung phat ngon ky thuat. KHI VIET CONTENT ky thuat (bai dang OA, post FB, email khach hang) → LUON tra cuu file nay TRUOC khi gọi ten tieu chuan.

> **CHU Y phan biet:** ASHRAE 55 / 62.1 / 62.2 la tieu chuan **MOI TRUONG** (thermal comfort, ventilation rate, residential IAQ) — KHONG phai tieu chuan san pham. Khong duoc gan vao spec van/cua gio/VAV.

---

## 1. Van ngan chay (Fire Damper) + Van ngan chay cach nhiet (Insulated Fire Damper)

| Ma tieu chuan | To chuc | Pham vi |
|---------------|---------|---------|
| **UL 555** | UL (My) | Fire damper — fire resistance test |
| **UL 555S** | UL (My) | Smoke damper — leakage at ambient & 250°C/350°F |
| **EN 1366-2** | CEN (EU) | Fire resistance test cho fire damper |
| **EN 1366-10** | CEN (EU) | Fire resistance test cho smoke control damper |
| **ISO 21925-2:2018** | ISO | Fire resistance — Smoke control dampers — Part 2: Classification |
| **QCVN 06:2023/BXD** | BXD VN | An toan chay cho nha va cong trinh (ban hanh kem TT 09/2023/TT-BXD, thay the QCVN 06:2022) |

**STARDUCT fire damper:** dat EI 180 theo EN 1366-2, vuot tieu chuan cao nhat EI 120 cua QCVN 06.

---

## 2. VAV Box (Variable Air Volume Terminal)

| Ma tieu chuan | To chuc | Pham vi |
|---------------|---------|---------|
| **AHRI 880** | AHRI (My) | Performance rating — air terminals (airflow, sound, pressure) |
| **AHRI 885** | AHRI (My) | Procedure for estimating occupied space sound levels from air terminals |
| **ASHRAE 130-2025** | ASHRAE | Methods of testing air terminal units (revision 2025) |

**STARDUCT VAV:** nha san xuat DUY NHAT tai VN co chung chi AHRI 880.

---

## 3. Van VCD (Volume Control Damper)

| Ma tieu chuan | To chuc | Pham vi |
|---------------|---------|---------|
| **AMCA 500-D** | AMCA | Laboratory methods of testing dampers (torque, leakage class I/II/III, pressure drop) |

---

## 4. Louver

| Ma tieu chuan | To chuc | Pham vi |
|---------------|---------|---------|
| **AMCA 500-L** | AMCA | Laboratory methods of testing louvers (water penetration, free area, pressure drop) |

---

## 5. Cua gio / Mieng gio (Air Grille, Diffuser, Register)

| Ma tieu chuan | To chuc | Pham vi |
|---------------|---------|---------|
| **ASHRAE 70-2023** | ASHRAE | Method of testing the performance of air outlets and inlets (throw, NC, pressure drop) |

---

## TIEU CHUAN MOI TRUONG — KHONG DUNG CHO SAN PHAM

Cac tieu chuan duoi day la tieu chuan DESIGN / IAQ / COMFORT — **TUYET DOI khong gan vao spec san pham van/cua/VAV**:

| Ma | Pham vi DUNG |
|----|--------------|
| **ASHRAE 55** | Thermal Environmental Conditions for Human Occupancy — dieu kien tien nghi nhiet do/do am cho con nguoi |
| **ASHRAE 62.1** | Ventilation for Acceptable Indoor Air Quality (non-residential) — luu luong gio tuoi toi thieu/nguoi |
| **ASHRAE 62.2** | Ventilation and Acceptable Indoor Air Quality in Residential Buildings — chuan thong gio nha o |

**Vi du SAI:** "VAV Box STARDUCT dat tieu chuan ASHRAE 62.1" — SAI, vi 62.1 la chuan thiet ke thong gio cho cong trinh, khong phai test san pham.
**Cach DUNG:** "VAV Box STARDUCT dap ung yeu cau luu luong gio tuoi theo ASHRAE 62.1" (mo ta UNG DUNG, khong phai chung nhan san pham).

---

## NGUON DATA SOURCE
- Yeu cau tu Sep Khanh — Issue #23, 13/05/2026
- Google Sheet: `15GLw7PyJ9DTmfQfIzM9nhEsbJVpsywYDaPuj-WB7UP0` (gid=1435957101)
- Lien quan: [[hvac-knowledge.md]] (cong thuc + thuat ngu day du)

## CAP NHAT
Khi co tieu chuan moi → goi `memory_update` voi topic="hvac-standards" de them vao `/root/.openclaw/lena-learned/hvac-standards.md` (overlay khong ghi de file goc).
