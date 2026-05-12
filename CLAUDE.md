# CLAUDE.md — Le Na CEO Agent

Tro ly AI 24/7 cho CEO Dao Huy Khanh (NSCA/STARDUCT). Chay tren Railway, phuc vu 3 VIP (Sep Khanh, Chi Hong, Anh Ngoc) qua Zalo OA va Dashboard.

## 2 moi truong, 2 Le Na

| Kenh | Stack | Tool co | Khi nao dung |
|---|---|---|---|
| **Zalo OA app** | `proxy.js` webhook → Claude API + TOOLS array | drive_list, zalo_oa_article, gemini_write, 21 tool | VIP nhan tin tu dien thoai → Le Na tu xu ly |
| **Dashboard** (`/chat`) | OpenClaw embedded agent | bash exec generic | Debug, gõ `exec:` thu nghiem |

2 Le Na **doc lap**, KHONG share state. Code production trong proxy.js TOOLS array. Mai se unify (Option A — them endpoint `/dashboard-chat`).

## File phai doc khi vao phien

1. **AGENTS.md** — system prompt Le Na (3 VIP, 13 cron, workflow dang bai)
2. **SKILLS.md** — index 8 skill + 22 runtime tool + gotchas da verify
3. **MEMORY.md** trong memory/ — long-term memory cross-session
4. **memory/zalo_oa_api_state.md** — Zalo OA endpoint con song / da chet (cap nhat 12/05/2026)

## Quy tac dev (BAT BUOC)

- **KHONG bia ngay/thang.** Chay `date "+%A %d/%m/%Y %H:%M %Z"`.
- **KHONG push thang main.** Luon branch `claude/<topic>` → PR → merge.
- **Token Zalo OA** la SECRET. Khong luu vao memory, code, commit. Khi rotate phai update CA 3 noi: env Railway, `/app/.env.json` (auto qua start.sh), `/root/.openclaw/zalo-oa-token.json` (xoa de force refresh).
- **Sua skill** → test bang `/email`, `/baocao`, `/kpi`, `/khkd`, `/npp`, `/climanexus`, `/export`, `/lich`.

## Chi phi token

- Sonnet 4.5: VIP + quyet dinh nhay cam
- Haiku 4.5: dashboard, cron, email VN (default)
- Gemini Flash (free): viet bai dai, bao cao
- Muc tieu: <$0.85/ngay

## Stack ngan

- Container: Docker → Railway service `lena-ceo-agent`, project `exquisite-serenity`
- Process: `proxy.js` (Express, port public) + OpenClaw gateway (port 8090 internal)
- Persistent volume: `/root/.openclaw/` (token cache, session, follower DB, Zalo event log)
- Zalo OA: app `Lena AI Starasia` (id `3271178555642588528`), OA "Starasia JSC" (id `3574723519900979654`)
- Google Drive: folder STARDUCT 394 anh (id `1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR`), shared "Anyone with link"

Doc tiep [SKILLS.md](./SKILLS.md) de biet Le Na hien lam duoc gi.
