# SKILLS.md — Le Na lam duoc gi

Index toan bo nang luc cua Le Na: 8 skill file (workflow phuc tap) + 22 runtime tool (atomic action) + gotchas da verify runtime.

## Skill files (workflow nhieu buoc)

8 file trong `skills/` — moi file 1 workflow CEO goi qua slash command:

| File | Command | Trigger | Muc dich |
|---|---|---|---|
| [email-scan.md](skills/email-scan.md) | `/email` | "check email", "quet email" | Quet inbox 24h, phan loai 3 cap do, tom tat |
| [weekly-report.md](skills/weekly-report.md) | `/baocao`, `/report` | T2 sang | Tong hop bao cao 14 bo phan, soan email + Doc cho CEO |
| [kpi-dashboard.md](skills/kpi-dashboard.md) | `/kpi` | Hoi ve KPI thang/tuan | Aggregate KPI Tracker, traffic light A/B/C/D |
| [khkd-variance.md](skills/khkd-variance.md) | `/khkd` | "KHKD", "variance", "lech bao nhieu" | So sanh KHKD 2026 Baseline vs Thuc te, neu nguyen nhan |
| [npp-tracker.md](skills/npp-tracker.md) | `/npp` | Hoi NPP, don hang | Quet 5 NPP noi dia, doanh so vs target |
| [climanexus-export.md](skills/climanexus-export.md) | `/climanexus`, `/export` | Hoi du an ClimaNexus | KPI ClimaNexus, Export Revenue, Intl Pipeline |
| [sunday-meeting-prep.md](skills/sunday-meeting-prep.md) | `/lich` | CN toi | Chuan bi tai lieu hop giao ban T2 |
| [dept-reminder.md](skills/dept-reminder.md) | (cron) | 21h CN | Nhac BP chua nop bao cao tuan |

## Runtime tools (22 atomic — TOOLS array trong proxy.js)

Le Na (Zalo flow) tu chon tool phu hop:

**Email & Calendar**
- `email_send`, `email_read`, `email_reply` — Gmail (token OAuth dhk@nsca.vn)
- `calendar_read`, `calendar_create` — Google Calendar 3 VIP

**Google Sheets** (21 tab tren Sheet ID env `GOOGLE_SHEET_ID`)
- `sheets_read`, `sheets_write`, `sheets_append`
- 21 tab co san: CEO Daily Dashboard, KPI Tracker, Meeting Notes, Market Research, Email Action Log, Report Tracker, Attachment Analysis, Activity Log, KHKD 2026 Baseline, NPP Tracker, Variance Log, ClimaNexus KPI, ClimaNexus Milestones, ClimaNexus Pipeline, Export Revenue, International Pipeline, Santiago KPI, Intl Market Log, Weekly Performance, NPP Orders, Task Tracker

**Google Docs & Drive**
- `gdoc_create` — tao Google Doc tu noi dung
- `drive_list` — liet ke file folder Drive (default folder STARDUCT 394 anh). Tra ve `public_url` format `lh3.googleusercontent.com/d/<id>` de Zalo CDN fetch
- `drive_download` — tai file Drive ve `/tmp/<filename>`

**Task tracking**
- `task_add`, `task_overdue`, `task_status`, `task_update` — quan ly Sheet "Task Tracker"

**Zalo OA**
- `zalo_oa_send_to_vip` — nhan tin RIENG cho 1 VIP (sep-khanh / chi-hong / anh-ngoc)
- `zalo_oa_history` — doc tin nhan VIP da gui tu file `/root/.openclaw/zalo-events.jsonl`. Timestamps da convert sang Asia/Ho_Chi_Minh +7
- `zalo_oa_article` — DANG BAI len trang OA Starasia JSC (public). Schema cover bat buoc:
  ```json
  "cover": {"cover_type": "photo", "photo_url": "<URL public>", "status": "show"}
  ```

**Content generation**
- `gemini_write` — Gemini Flash viet bai dai (FREE)
- `image_overlay` — ghep logo STARDUCT + text len anh, layouts: hero / banner-bottom / banner-left / minimal

**System**
- `github_create_issue` — tao GitHub issue khi Sep yeu cau sua code/cron
- `kpi_update` — auto-aggregate KPI Tracker tu cac sheet khac (cron T7 22h)

## Cron jobs (13 — chay tu dong)

| Gio | Cron job | Cho ai |
|---|---|---|
| 8h30 T2-T7 | Calendar Briefing | 3 VIP |
| 9h T2-T7 | NPP Scan | Anh Ngoc |
| 9h T2 | PKD Team Report | Anh Ngoc |
| 9h30 T2 | Weekly Business Report | Sep + 11 BP |
| 9h30 T2-T7 | Task Overdue Check | Sep |
| 17h T2-T7 | TCKT Email Triage | Chi Hong |
| 17h T2-T7 | Email Triage Anh Ngoc | Anh Ngoc |
| 8h T3 | Meeting Minutes Check | Sep |
| 21h30 T7 | Weekly Email Scan | Sep |
| 21h T7 | Weekly Report Scan + Luu Sheet | Sep |
| 21h CN | Report Reminder 11 BP | 11 BP |
| 22h T7 | KPI Tracker Update | (backend) |
| 21h cuoi thang | Monthly Closing (PKD + Tong) | Sep + Anh Ngoc |

## Gotchas da verify runtime (do NOT forget)

### Zalo OA Article (12/05/2026)
- Schema cover BAT BUOC `{ cover_type: 'photo', photo_url: <URL>, status: 'show' }`
- `cover_type: "photo"` la enum STRING duy nhat hop le. So (0, 1, 3) hay "image", "normal" deu invalid
- `photo_url` PHAI la URL public, Zalo CDN fetch. Local path KHONG hoat dong
- `status: "show"` BAT BUOC. Thieu se fail "create media fail"
- `/v2.0/article/upload_image` va `/upload_video_or_cover` da bi Zalo go (HTTP 404, -209). KHONG dung
- Verify step thuong fail lan dau voi -214 "Media being processed". Code da co retry backoff 2s→4s→6s→8s→12s

### Google Drive cover URL
- Dung `https://lh3.googleusercontent.com/d/<fileId>` — return image truc tiep, content-type image/jpeg, no redirect
- KHONG dung `drive.google.com/uc?export=view&id=<id>` — Zalo CDN khong follow 303 redirect
- Folder phai share "Anyone with link" → Viewer

### Zalo OA Token rotation
- Token cache 3 noi: env Railway, `/app/.env.json` (sync 1 lan o start.sh startup), `/root/.openclaw/zalo-oa-token.json` (uu tien doc cao nhat, persistent volume)
- Scripts doc theo thu tu: file persistent → file `/app/.env.json` → env Railway
- Khi rotate: update env Railway + redeploy + xoa cache file persistent + curl `/refresh-token`
- `/debug` endpoint chi check truthy, KHONG verify thuc te voi Zalo

### Webhook flow
- Tin Zalo → `POST /zalo-webhook` → `proxy.js handleUserMessage` (text) hoac `handleImageMessage` (anh)
- handleUserMessage chay Claude API agent loop voi TOOLS array, MAX_ITER = 15
- handleImageMessage chi reply canned "Anh muon em lam gi", KHONG agent loop
- Tin tu Zalo card preview (link voi thumbnail) co the trigger user_send_image thay vi user_send_text → loop hoi "anh muon lam gi"

### Auto-refresh token
- proxy.js co `setInterval(refreshOAToken, 20h)` o startup
- Refresh fail SILENT — chua co alert. Sep khong biet cho den khi Le Na im
- TODO: cron daily verify + email alert (xem memory/project_lena_followups.md)

## 2 Le Na khac nhau

| | Zalo flow | Dashboard flow |
|---|---|---|
| Code | proxy.js handleUserMessage | OpenClaw embedded |
| Tool | TOOLS array (22 tool) | bash exec generic |
| System prompt | Inline trong proxy.js | `/root/.openclaw/workspace/AGENTS.md` |
| Webhook URL | `/zalo-webhook` | `/chat?session=agent:main:main` |
| Trigger | Zalo OA app | Dashboard UI |

Khi cap nhat AGENTS.md → CHI anh huong Dashboard. Khi cap nhat proxy.js → CHI anh huong Zalo. Tuong lai unify qua endpoint `/dashboard-chat` (xem followups).

## Stack chi tiet

- **Container**: Docker tren Railway, image OpenClaw + Node + Google CLI
- **Proxy public**: Express (port `${PORT}`) serve static + forward toi OpenClaw
- **OpenClaw gateway**: port 8090 internal, plugin Anthropic
- **Models**: Claude Sonnet 4 (VIP), Claude Haiku 4.5 (default), Gemini Flash (content), GPT-4o (fallback)
- **Storage**:
  - Sessions: `/root/.openclaw/agents/main/sessions/<sessionId>.jsonl`
  - Followers: `/root/.openclaw/zalo-oa-followers.json`
  - Events: `/root/.openclaw/zalo-events.jsonl` (append-only)
  - Token: `/root/.openclaw/zalo-oa-token.json`
- **Auth**: Google OAuth (refresh token cho 4 service: Gmail, Sheets, Calendar, Drive). Zalo OAuth (token rotate 25h).
