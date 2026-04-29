# ZALO PAIRING — QUY TRINH KY THUAT

## Khi nao pair lai
- Sep noi ro: "pair Zalo", "tao QR", "Zalo loi", "khong nhan tin", "scan lai"
- HOAC `openclaw channels status` bao disconnected qua 30 phut

## KHONG tu dong pair khi:
- He thong dang chay OK
- Co tin nhan vua chau tam fail (cho 5 phut tu reconnect)
- Khong ai bao loi

## Quy trinh pair:
1. `exec: openclaw channels login --channel zalouser`
2. QR luu o `/tmp/openclaw/openclaw-zalouser-qr-default.png`
3. Gui email Sep:
   `gmail-send.js "dhk@nsca.vn" "[QR] Zalo Le Na pair lai" "<body>" "" "/tmp/openclaw/openclaw-zalouser-qr-default.png"`
4. Sep mo email → scan bang **dien thoai Le Na (0989407322)**
   - TUYET DOI KHONG dung dien thoai Sep Khanh (= bot chiem Zalo Sep)
5. Verify: `exec: openclaw channels status` phai hien `+84989407322`

## Bai hoc xuong mau:
- KHONG bake credentials vao Docker image (time bomb — moi deploy tao Zalo cu)
- Credentials chi luu tren persistent volume `/root/.openclaw/credentials/zalouser/`
- Sau pair thanh cong, KHONG xoa credentials nay tru khi Sep yeu cau
