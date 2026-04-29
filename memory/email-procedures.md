# Email Procedures — Le Na

## Doc email DUNG
Inbox dhk@nsca.vn co hang tram nghin email. LUON dung filter:
- Doc tu 1 nguoi: `node /app/google-tools/gmail-read.js 168 10 "from:ngocnv@nsca.vn"`
- Doc theo chu de: `node /app/google-tools/gmail-read.js 168 50 "subject:bao cao"`
- Doc email CHUA DOC: `node /app/google-tools/gmail-read.js 24 30 "is:unread"`
- Doc co DINH KEM: `node /app/google-tools/gmail-read.js 168 20 "has:attachment from:ngocnv@nsca.vn"`
- KHONG BAO GIO doc email ma khong co filter!

## Quet bao cao tuan tu 14 BP
BUOC 1 — Thread SX chung (6 BP):
`node /app/google-tools/gmail-read.js 168 30 "subject:\"BAO CAO BO PHAN SAN XUAT TUAN\""`
BP trong thread: anh Tung (thep), anh Phong (co dien), chi Ha (kho), chi Kim Anh (cung ung), chi Xuan-khsx01 (nhom), anh Ngoc NV (GD NM), anh Duc GH (ducvt)

BUOC 2 — 8 BP con lai:
- `node /app/google-tools/gmail-read.js 168 15 "from:duannt@nsca.vn"` — TCKT
- `node /app/google-tools/gmail-read.js 168 15 "from:sondt@nsca.vn"` — HCNS (LUU Y: sondt@)
- `node /app/google-tools/gmail-read.js 168 15 "from:ndao@nsca.vn"` — PKD
- `node /app/google-tools/gmail-read.js 168 15 "from:ducdd@nsca.vn"` — BD Noi dia
- `node /app/google-tools/gmail-read.js 168 15 "from:santiago@nsca.vn"` — BD Intl
- `node /app/google-tools/gmail-read.js 168 15 "from:tamntt@nsca.vn"` — Back Office
- `node /app/google-tools/gmail-read.js 168 15 "from:namph@nsca.vn"` — R&D
- `node /app/google-tools/gmail-read.js 168 15 "from:tuannl@nsca.vn"` — QAQC

LUU Y:
- HCNS: email la sondt@nsca.vn (KHONG PHAI sondv)
- SX Nhom: chi Xuan (khsx01@nsca.vn) gui thay anh Ngoc
- Giao Hang: ducvt@nsca.vn (khac BD Noi dia ducdd@nsca.vn)

## Phan loai email
1. TRA LOI DUOC NGAY: xac nhan, lich hop, thong tin cong khai, nhac nho
2. CAN CEO DUYET: hop dong, bao gia, tai chinh lon, khieu nai
3. KHONG TRA LOI: spam, quang cao

## CC email
- THAY MAT Sep Khanh → CC dhk@nsca.vn
- THAY MAT chi Hong → CC nsca@nsca.vn
- TCKT → CC ca 2

## Chu ky email
```html
<br>---<br>
<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
  <tr>
    <td style="padding-right:15px;vertical-align:top;">
      <img src="https://raw.githubusercontent.com/dhk1805-creator/lena-ceo-agent/main/lena-avatar.jpg" width="50" height="50" style="border-radius:50%;" alt="Le Na">
    </td>
    <td>
      <strong style="font-size:14px;color:#1a5276;">Đào Thị Lê Na</strong><br>
      Trợ lý CEO Đào Huy Khánh<br>
      <strong>NSCA / STARDUCT</strong><br>
      Email: lena@nsca.vn | Tel: 0903 232 222<br>
      <em style="font-size:11px;color:#888;">AI Executive Assistant</em>
    </td>
  </tr>
</table>
```

## Bao mat
KHONG tiet lo: KHKD, KQKD, KPI noi bo, cong no, tai chinh, ClimaNexus, gia ban, nhan su
