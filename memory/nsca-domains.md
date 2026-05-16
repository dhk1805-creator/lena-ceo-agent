# DOMAIN & WEBSITE CỦA NSCA / STARDUCT

Lê Na dùng file này để biết mỗi câu hỏi nên `web_read` website nào, và trích nguồn đúng.

**QUY TẮC BẮT BUỘC:**
- Khi VIP / nhân viên / khách hỏi về sản phẩm hoặc dự án của NSCA-STARDUCT → ƯU TIÊN `web_read` domain phù hợp dưới đây TRƯỚC khi trả lời từ trí nhớ chung.
- LUÔN trích nguồn URL cụ thể ở cuối câu trả lời.
- KHÔNG bịa nội dung khi `web_read` không truy cập được; nói thẳng "em chưa truy cập được, dựa trên trí nhớ".

---

## Domain chính

| Domain | Phụ trách | Khi nào dùng |
|---|---|---|
| **starduct.vn** | Sản phẩm HVAC chính: cửa gió, miệng gió, van ngăn cháy, VAV, VCD, louver, ống gió, phụ kiện | Mọi câu hỏi về sản phẩm cứng STARDUCT, catalogue, datasheet, ứng dụng |
| **nsca.vn** | Trang công ty cổ phần Ngôi Sao Châu Á | Câu hỏi về công ty mẹ, tuyển dụng, liên hệ chung |
| **climanexusvn.com** | Dự án **ClimaNexus** — giải pháp home automation HVAC/IAQ cho thị trường tropical Asia, định hướng luxury residential | Mọi câu hỏi về ClimaNexus: tính năng, công nghệ sensible-latent decoupling, mục tiêu tiết kiệm năng lượng, định vị thị trường |
| **tool.starductselection.com** | STARDUCT Selection Tool Hub — phần mềm tra chọn sản phẩm (SLD, VCD, SVAV-S, fire damper, v.v.) | Câu hỏi về chọn sản phẩm theo lưu lượng, áp suất, NC; tra mã sản phẩm; submittal data; AHRI/AMCA/Intertek certs |

## Cách dùng cụ thể theo câu hỏi

- Hỏi "đặc điểm miệng gió/cửa gió/van/VAV/louver ... STARDUCT" → `web_read` trang danh mục tương ứng trên `starduct.vn`. Nếu cần chi tiết một mã sản phẩm cụ thể → `web_search "site:starduct.vn [mã SP]"` rồi `web_read` trang detail.

- Hỏi về **ClimaNexus** (tính năng, công nghệ, mục tiêu) → `web_read https://climanexusvn.com` (hoặc subpage tương ứng nếu biết). Trích nguồn `climanexusvn.com` ở cuối.

- Hỏi về chọn sản phẩm / submittal / spec kỹ thuật chi tiết → trỏ tới `tool.starductselection.com`. Lưu ý đây là SPA, `web_read` chỉ lấy được module list, không drill sâu được — workaround: VIP gửi screenshot.

- Hỏi về tuyển dụng / thông tin công ty mẹ → `web_read nsca.vn`.

## Lưu ý quan trọng

- Đây là TRÍ NHỚ về domain, không phải nội dung sản phẩm. Để biết nội dung sản phẩm thật → bắt buộc `web_read` chính website đó, không trả lời "chay" từ tên domain.

- Khi Sếp Khánh giới thiệu thêm domain mới (vd: subdomain dự án, microsite triển lãm) → `memory_update` thêm vào file này.

- Một số domain có thể có cả phiên bản tiếng Anh (vd: `starduct.vn/en`) — dùng bản tiếng Việt mặc định, trừ khi VIP/khách viết tiếng Anh.
