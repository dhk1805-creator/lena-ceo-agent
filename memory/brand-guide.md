# STARDUCT Brand Guidelines

**Website:** https://starduct.vn/
**Brand colors:**
- Primary: Cam (#F7941D)
- Secondary: Xam dam (#4A4A4A)
- Accent: Den (#000000)
- Background: Trang hoac xam nhat
**Slogan:** "Trusted Performance"
**Tone:** Chuyen nghiep, dang tin cay, cong nghe cao, tu hao Viet Nam

## Logo files (trong container)
- `/app/assets/logo-color.png` — Logo cam (nen trang)
- `/app/assets/logo-black.png` — Logo den
- `/app/assets/logo-white.png` — Logo trang (nen trong)
- `/app/assets/logo-slogan.png` — Logo + "Trusted Performance"

**Logo URL (GitHub raw):**
- https://raw.githubusercontent.com/dhk1805-creator/lena-ceo-agent/main/assets/logo-color.png
- https://raw.githubusercontent.com/dhk1805-creator/lena-ceo-agent/main/assets/logo-slogan.png

## Kho anh STARDUCT (Google Drive)
- **Folder ID:** 1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR
- Chua ~394 anh: nha may, san pham, trien lam, doi tac...
- Liet ke: `node /app/google-tools/drive-list.js "1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR"`
- Tim anh: `node /app/google-tools/drive-list.js "1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR" "VAV"`
- Tai ve: `node /app/google-tools/drive-download.js "<fileId>" "/tmp/photo.jpg"`

## Danh muc san pham (starduct.vn/danh-muc)
1. Cua gio/Mieng gio — starduct.vn/cua-giomieng-gio-c-1
2. Van gio va Van ngan chay (EI) — starduct.vn/van-gio-va-van-ngan-chay-c-10
3. Thang & mang cap dien — starduct.vn/thang-mang-cap-dien-c-16
4. C Channel — starduct.vn/c-chanel1-c-19
5. Ong gio mem & noi mem — starduct.vn/ong-gio-mem-noi-mem-c-20
6. Ong gio ma kem va ong EI — starduct.vn/ong-gio-ma-kem-va-ong-ei-c-22
7. Tieu am va louver tieu am — starduct.vn/tieu-am-va-louver-tieu-am12-c-24
8. VAV Box & CAV — starduct.vn/vav-box-cav-c-25
9. Khung gia do pin mat troi — starduct.vn/khung-gia-do-lap-dat-pin-nang-luong-mat-troi-c-34
10. Quat thong gio NEDFON — starduct.vn/quat-thong-gio-nedfon-c-274
11. Spec Master & Submittals Build — starduct.vn/spec-master-and-submittals-build1-c-371
12. Chuong trinh OEM — starduct.vn/chuong-trinh-hop-tac-oem-c-373

## Blog (starduct.vn/blog)
1. OEM Partnership (03/2026)
2. VAV Box thong minh IoT (01/2026)
3. AHRI 880 — Top 57 thuong hieu (11/2025)
4. Son tinh dien AAMA 2603/2604 (11/2025)
5. Kiem tra ro ri VAV Box (11/2025)
6. Tieu chuan HVAC VAV (09/2025)
7. Thue doi ung Hoa Ky (07/2025)
8. Global Supply Chain (06/2025)
9. SME & GDP (01/2026)

## Thong diep marketing
- STARDUCT = nha san xuat HVAC hang dau Viet Nam, xuat khau 10+ quoc gia
- Chung nhan: UL, FM, AHRI 880, AAMA 2603/2604, AMCA
- Cong nghe: IoT-enabled VAV, smart HVAC, Industry 4.0
- Doi tac: Belimo, Nippon
- USP: "Made in Vietnam, World-class Quality"

## Tao banner
- Dung image_generate voi mau CAM #F7941D bat buoc
- KHONG dung xanh duong, xanh la, tim
- Text tieng Viet dung chinh ta, ngan gon 5-7 tu
- Neu can ghep logo that: `node /app/google-tools/image-overlay.js`
