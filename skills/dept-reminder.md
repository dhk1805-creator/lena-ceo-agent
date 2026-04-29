# Skill: Department Report Reminder
# Lenh: Khong co lenh truc tiep — chay tu dong qua cron
# Trigger: Cron job Thu 5 sang + Thu 6 chieu

## Muc dich
Tu dong gui email nhac 14 truong bo phan nop bao cao hang tuan dung deadline Thu 6 17:00.

## Steps

### 1. Kiem tra trang thai nop bao cao
Doc Google Sheets "Report Tracker" (sheet #6):
- Bo phan nao da nop?
- Bo phan nao chua nop?

### 2. Gui nhac lan 1 — Thu 5 sang 9:00 (nhac truoc)

**Doi tuong:** TAT CA 14 truong bo phan
**Kenh:** Email
**Subject:** [NSCA] Nhac nop bao cao tuan — Deadline: Thu 6 17:00

```
Kinh gui anh/chi [Ten],

Em la Le Na, Tro ly AI cua Sep Khanh.

Em xin nhac anh/chi vui long gui bao cao tuan cua bo phan [Ten bo phan] 
truoc 17:00 ngay Thu 6 ([ngay/thang]).

Bao cao gui ve: dhk@nsca.vn
Format: Theo mau bao cao tuan da thong nhat

Neu anh/chi da gui roi, xin bo qua email nay a.

Tran trong,
Le Na
Tro ly AI — CEO Office
NSCA / STARDUCT
```

### 3. Gui nhac lan 2 — Thu 6 14:00 (nhac gap)

**Doi tuong:** CHI nhung bo phan CHUA NOP
**Kenh:** Email
**Subject:** [NSCA] NHAC LAN 2 — Bao cao tuan can nop truoc 17:00 hom nay

```
Kinh gui anh/chi [Ten],

Em la Le Na. Hien bo phan [Ten bo phan] chua gui bao cao tuan.
Deadline: 17:00 HOM NAY Thu 6 ([ngay/thang]).

Anh/chi vui long gui som giup em de em tong hop trinh Sep Khanh 
cho hop giao ban sang Thu 2 a.

Gui ve: dhk@nsca.vn

Cam on anh/chi!

Le Na
Tro ly AI — CEO Office
```

### 4. Bao cao CEO — Thu 6 17:30

Gui Zalo cho Sep Khanh:

```
BELL Bao cao tinh hinh nop bao cao tuan
Thoi han: Thu 6 17:00

GREEN_CIRCLE Da nop ([X]/14):
- [Liet ke ten truong phong + bo phan]

RED_CIRCLE Chua nop ([Y]/14):
- [Liet ke ten truong phong + bo phan]

POINT_RIGHT Em da nhac 2 lan. Anh can em nhac them lan nua khong a?
```

## Danh sach email 14 truong bo phan

| # | Bo phan | Truong | Gioi tinh | Cach goi | Email |
|---|---------|--------|-----------|----------|-------|
| 1 | R&D | Pham Hoai Nam | Nam | anh Nam | namph@nsca.vn |
| 2 | HCNS | Dang Van Son | Nam | anh Son | sondv@nsca.vn |
| 3 | PKD | Dao Nguyen Ngoc | Nam | anh Ngoc (Boc Beo) | ndao@nsca.vn |
| 4 | BD Noi dia | Tran Minh Duc | Nam | anh Duc | ducdd@nsca.vn |
| 5 | BD International | Santiago de los Reyes | Nam | anh Santiago | santiago@nsca.vn |
| 6 | Back Office | Nguyen Thi Thanh Tam | Nu | chi Tam | tamntt@nsca.vn |
| 7 | TCKT | Nguyen Tien Duan | Nam | anh Duan | duannt@nsca.vn |
| 8 | GD Nha may / SX Nhom | Nguyen Van Ngoc | Nam | anh Ngoc | ngocnv@nsca.vn |
| 9 | SX Thep | Hoang Manh Tung | Nam | anh Tung | tunghm@nsca.vn |
| 10 | Co Dien | Dinh Van Phong | Nam | anh Phong | phongdv@nsca.vn |
| 11 | QA/QC | Nguyen Luong Tuan | Nam | anh Tuan | tuannl@nsca.vn |
| 12 | Kho | Nguyen Thi Ha | Nu | chi Ha | hant@nsca.vn |
| 13 | Giao Hang | Vu Trong Duc | Nam | anh Duc | ducvt@nsca.vn |
| 14 | Cung Ung | Dang Thi Kim Anh | Nu | chi Kim Anh | anhdtk@nsca.vn |

## Luu y
- Email nhac phai LICH SU, ton trong — khong duoc co giong ra lenh
- Xung "em" voi tat ca truong phong
- Voi Santiago: gui email bang TIENG ANH
- Neu truong phong reply hoi gi → chuyen cho CEO xu ly
- Luu log nhac nho vao Google Sheets "Activity Log" (sheet #8)
