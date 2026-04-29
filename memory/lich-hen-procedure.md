# QUY TRINH LICH HEN — CHI TIET

## NGUYEN TAC VANG
**KHONG TU Y XAC NHAN lich hen tu nguoi ngoai. Phai xin y kien VIP truoc.**

## Routing theo email nhan:
| Email den | Xin y kien | Zalo ID |
|---|---|---|
| dhk@nsca.vn | Sep Khanh | 255067431607136002 |
| ndao@nsca.vn | Anh Ngoc | (resolve qua 0902115796, luu contacts.md) |
| nsca@nsca.vn | Chi Hong | 2389450107733864097 |

## QUY TRINH 7 BUOC (lich tu nguoi ngoai)

### BUOC 1: Phat hien yeu cau lich hen
- Email/Zalo tu nguoi ngoai gui den dhk@/ndao@/nsca@
- Tom tat: ai, khi nao, dia diem, muc dich, thoi luong

### BUOC 2: Check trung lich
`exec: node /app/google-tools/calendar-read.js 7`

### BUOC 3: Xin y kien VIP qua Zalo
Format:
```
📅 LICH HEN MOI
👤 [Ten nguoi]
🕐 [time] [date]
📍 [dia diem]
🎯 [muc dich]
Anh/chi co dong y khong a?
```

### BUOC 4: Cho dong y
- ✅ Dong y → BUOC 5
- ❌ Khong dong y → tra loi nguoi ngoai theo y VIP, EXIT
- ❓ Khong tra loi sau 2 gio → CHO, KHONG tu xac nhan

### BUOC 5: Tao Calendar event (auto reminder native)
`exec: node /app/google-tools/calendar-create.js "<title>" "<start_iso>" "<end_iso>" "<description>" "<attendees>"`
- calendar-create.js mac dinh set: email 60min before + popup 60min before + popup 10min before
- Calendar tuong ung: dhk@/ndao@/nsca@

### BUOC 6: Tra loi nguoi ngoai xac nhan
- Soan email lich su xac nhan (Le Na ky ten)
- Gui invite Calendar
- CC email VIP

### BUOC 7: Bao Zalo VIP da setup
"✅ Da set up lich [time] [date] voi [nguoi]. Da gui invite Calendar."

## NHAC NHO
- 7h sang: cron `daily-calendar-morning-briefing` bao tong hop lich ngay
- Truoc 60 phut: Google Calendar TU DONG nhac (email + popup, da set khi tao event)
- KHONG can cron rieng

## NGOAI LE — KHONG CAN XIN Y KIEN
- VIP TU yeu cau Le Na dat lich → vao BUOC 5 luon
- Lich noi bo da co trong calendar (chi xac nhan tham gia)
- Lich lap lai dinh ky da thoa thuan truoc

## CAM TUYET DOI
- Tu y xac nhan lich voi nguoi ngoai
- Tao calendar event truoc khi VIP dong y
- Bo qua xin y kien (du la "khach quen")

## GHI NHO
Sau khi tao lich → ghi `memory/contacts.md`: nguoi, lich, ngay, ket qua hop (sau)
