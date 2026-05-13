# CLAUDE.md — Le Na CEO Agent

Tro ly AI cho CEO Dao Huy Khanh (NSCA/STARDUCT), 24/7 tren Railway. 3 VIP: Sep Khanh, Chi Hong, Anh Ngoc.

## Kien truc 30s
- **Zalo OA** → `proxy.js` webhook → Claude API + 22 tool. PRODUCTION.
- **Dashboard** (`/chat`) → OpenClaw embedded, bash exec generic. DEBUG only.
- 2 Le Na doc lap. Sua tool → trong `proxy.js`. Sua prompt Dashboard → `AGENTS.md`.

## Rules
- **KHONG bia ngay/thang.** Chay `date "+%A %d/%m/%Y %H:%M %Z"`.
- **KHONG push main.** Branch `claude/<topic>` → PR → merge.
- **Token Zalo OA = SECRET.** Khong commit, khong log, khong memory.

## Doc theo nhu cau
- Can biet Le Na lam gi → `SKILLS.md`
- Sua workflow Le Na → `AGENTS.md`
- Gotcha Zalo/Drive/Token → `memory/zalo_oa_api_state.md`
- Viec dang lam → `memory/project_lena_followups.md`

## Stack
Railway service `lena-ceo-agent` / project `exquisite-serenity`. Persistent volume `/root/.openclaw/`.
