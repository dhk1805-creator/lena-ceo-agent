# Skill: Email Scan
# Lenh: /email
# Trigger: CEO gui "/email" hoac "check email", "quet email"

## Muc dich
Quet inbox dhk@nsca.vn trong 24h gan nhat, phan loai va tom tat cho CEO.

## Steps

### 1. Ket noi Gmail
- Doc inbox dhk@nsca.vn (24h gan nhat)
- Chi lay email gui TRUC TIEP cho dhk@nsca.vn (TO field)
- Bo qua: spam, newsletter, quang cao

### 2. Phan loai email (3 cap do)

| Cap do | Tieu chi | Emoji |
|--------|----------|-------|
| KHAN CAP | Tu khach hang (EAL, Quiet Cool, NPP), co deadline, hop dong, PO | RED_CIRCLE |
| QUAN TRONG | Tu truong phong (14 bo phan), bao cao, yeu cau duyet | YELLOW_CIRCLE |
| THUONG | Thong bao chung, CC, FYI | WHITE_CIRCLE |

### 3. Tom tat moi email
Format: **Nguoi gui** — Chu de — 1 dong noi dung — Action can lam

### 4. Tra loi CEO theo format

```
ENVELOPE Email 24h qua (dhk@nsca.vn)
Thoi gian: [gio hien tai]

RED_CIRCLE KHAN CAP ([so luong]):
1. [Nguoi gui] — [Chu de] — [Tom tat] 
   POINT_RIGHT Action: [Gi CEO can lam]

YELLOW_CIRCLE QUAN TRONG ([so luong]):
1. [Nguoi gui] — [Chu de] — [Tom tat]

WHITE_CIRCLE THUONG ([so luong]): [Liet ke ngan]

---
POINT_RIGHT Uu tien: [Email nao can reply truoc]
```

### 5. Xu ly dac biet
- Email tu OEM (EAL, Quiet Cool): Luon danh dau KHAN CAP
- Email tu NPP (NTK, Galaxy, VNMEP, IMP, MEPCO): KHAN CAP neu co khieu nai/deadline
- Email tu Santiago/INTL: KHAN CAP neu lien quan hop dong xuat khau
- Email tu TCKT (anh Duan): KHAN CAP neu lien quan thue, ngan hang

### 6. Auto-actions (neu duoc CEO cho phep)
- Draft reply cho email don gian (xac nhan da nhan, hen tra loi)
- Forward email chuyen mon den dung truong phong
- Dat reminder neu email co deadline

## Luu y
- Xung "em", goi CEO la "Sep Khanh" hoac "anh Khanh"
- Neu khong co email moi: "Da, anh Khanh, 24h qua khong co email moi nao can xu ly a"
- Gioi han Zalo ~2000 ky tu/tin nhan, chia thanh nhieu phan neu dai
