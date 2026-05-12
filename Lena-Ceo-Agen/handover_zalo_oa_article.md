---
name: Handover — Zalo OA Article API Debug
description: Handover cho Cowork debug Zalo OA article API trả về -209 "API is not support" trên upload và -201 "cover value is invalid" trên create
type: project
originSessionId: 4b597114-f972-4cba-94a6-b9957746abf2
---
# HANDOVER: Zalo OA Article — API endpoint issue

## Tình trạng hiện tại: STUCK tại API level

**Token đã OK** — OA Access Token mới đã set trên Railway, verify thành công với `/v2.0/oa/getoa` (trả về OA "Starasia JSC", verified, package Nâng cao).

**API article bị -209 và -201** — tất cả article endpoints đều fail:

| Endpoint | Error | Message |
|----------|-------|---------|
| `POST /v2.0/article/upload_image` | -209 | "API is not support" |
| `POST /v2.0/article/upload_video_or_cover` | -209 | "API is not support" |
| `POST /v2.0/article/create` (không cover) | -201 | "cover value is invalid" |
| `GET /v2.0/article/getslice` | -201 | "type accept only 2 value normal and video." |

## Đã làm xong

1. **Token re-authorized** (12/05/2026): CEO vào developers.zalo.me → Tools → API Explorer → chọn OA Access Token → Cấp quyền tất cả 13 quyền (bao gồm "Quản lý bài viết") → copy token mới
2. **Railway env vars updated**:
   - `ZALO_OA_ACCESS_TOKEN` = token mới (bắt đầu `fH-FLi...`)
   - `ZALO_OA_REFRESH_TOKEN` = refresh token mới (bắt đầu `46k2Ko...`)
3. **Token verify OK**: `GET /v2.0/oa/getoa` trả về success, OA name "Starasia JSC"
4. **Code fixes from earlier session** (đã push):
   - `zalo-oa-article.js`: upload endpoint sửa từ `/oa/upload/image` → `/article/upload_image`, PNG→JPEG, fallback không cover
   - `proxy.js`: capture stderr từ child tools

## Cần Cowork làm

### Giả thuyết cần kiểm tra:

1. **API version**: Có thể Zalo đã deprecate `/v2.0/article/*` và chuyển sang `/v3.0/` hoặc endpoint mới. Cần check Zalo API docs mới nhất (developers.zalo.me/docs → Zalo Official Account → Content)

2. **Permission chưa được duyệt**: Một số quyền Zalo cần Zalo team review/approve trước khi dùng được. Kiểm tra trong app settings trên developers.zalo.me xem quyền "Quản lý bài viết" có status "Đã duyệt" hay "Chờ duyệt"

3. **App config thiếu**: App "Lena AI Starasia" (APP_ID: `3271178555642588528`) có thể cần bật feature "Article" riêng trong app settings

4. **Cover bắt buộc**: Zalo article API yêu cầu cover image bắt buộc. Nếu upload endpoint fix được, cần upload ảnh trước rồi dùng URL trả về làm cover

### Key files:

- `D:\Projects\lena-ceo-agent\google-tools\zalo-oa-article.js` — main article tool
- `D:\Projects\lena-ceo-agent\proxy.js` — Express proxy, tool definitions
- `D:\Projects\lena-ceo-agent\google-tools\zalo-oa-refresh-token.js` — token refresh script

### Test commands:

```bash
# Test token validity
cd D:/Projects/lena-ceo-agent
railway run -- node -e "var t=process.env.ZALO_OA_ACCESS_TOKEN;fetch('https://openapi.zalo.me/v2.0/oa/getoa',{headers:{'access_token':t}}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))"

# Test article create
railway run -- node google-tools/zalo-oa-article.js create "Test" "Body text" "https://example.com/image.jpg"

# Test article list
railway run -- node google-tools/zalo-oa-article.js list
```

### Railway info:
- Project: exquisite-serenity
- Service: lena-ceo-agent
- Login: dhk1805@gmail.com
- CLI: `railway` (v4.45.0, path: `/c/Users/WELCOME/AppData/Roaming/npm/railway`)

### OA info:
- OA ID: 3574723519900979654
- APP ID: 3271178555642588528
- OA Name: Starasia JSC
- Package: Nâng cao
- Verified: Yes

## KHÔNG được thay đổi

- Token đã đúng, KHÔNG cần lấy lại
- `proxy.js` stderr logging đã fix, KHÔNG sửa lại
- Chỉ sửa article endpoint/format nếu tìm được docs xác nhận API mới

## [2026-05-12] Cập nhật từ Cowork session — diagnostic & code fix

### Diagnostic kết luận (12 endpoint probed qua `zalo-oa-diagnose.js`):

- **Permission `Quản lý bài viết` ĐÃ được cấp** (confirmed). Bằng chứng: `article/create` và `article/getslice` fail ở mức param (-201), không phải permission (-202/-211).
- **`/v2.0/article/upload_image` và `/v2.0/article/upload_video_or_cover` đã bị Zalo GỠ HOÀN TOÀN** (HTTP 404, -209).
- **Zalo CHƯA migrate article API sang v3.0** — các endpoint `v3.0/article/*` đều trả 404 invalid API.
- **Endpoint upload còn sống duy nhất: `/v2.0/oa/upload/image`** (test với empty buffer trả về -201 "file invalid, only png/jpeg" → endpoint live).

### Code fix đã apply:

`google-tools/zalo-oa-article.js` — chuyển upload sang `/v2.0/oa/upload/image`. Giữ nguyên fallback no-cover trong `createArticle` để phòng trường hợp URL bị `article/create` reject.

### ✅ SOLVED — schema cover chuẩn đã tìm được (sau 30+ probe runtime)

```json
"cover": { "cover_type": "photo", "photo_url": "<URL>", "status": "show" }
```

Quy tắc:
- `cover_type` enum STRING — chỉ "photo" hợp lệ
- `photo_url` phải là URL công khai (Zalo CDN fetch về)
- `status: "show"` BẮT BUỘC — thiếu sẽ fail "create media fail"
- `attachment_id` từ `/oa/upload/image` KHÔNG dùng được cho article
- Local file → phải upload lên CDN public (Imgur/ImgBB/Cloudinary) trước rồi pass URL

### File mới tạo / đã sửa trong session:
- `google-tools/zalo-oa-article.js` — code production sạch, schema đúng
- `google-tools/zalo-oa-diagnose.js` — script probe permission/endpoint (chạy lại bất cứ lúc nào nếu Zalo đổi API)
- `diagnose-out.json` — output diagnostic 12/05/2026

### Lưu ý vận hành:
- Nếu verify fail với "-200 Upload media failed: Too many failed attempts" → Zalo CDN đang rate-limit URL đó. Đợi vài phút hoặc đổi URL khác.
- `image-overlay.js` tạo ảnh local — để dùng cho article, cần upload lên CDN public trước. Phương án dài hạn: thêm tool `upload-public.js` upload file local lên Cloudinary/Imgur trả URL.
