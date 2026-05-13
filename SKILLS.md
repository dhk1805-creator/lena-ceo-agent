# SKILLS.md — Le Na lam gi

## Runtime tools (25 — `proxy.js` TOOLS)

| Nhom | Tool |
|---|---|
| Email | `email_send`, `email_read`, `email_reply` |
| Calendar | `calendar_read`, `calendar_create` |
| Sheets (21 tab, ID env) | `sheets_read`, `sheets_write`, `sheets_append` |
| Knowledge | `hvac_lookup` (Google Sheet HVAC: cong thuc/thuat ngu), `memory_search` (long-term: hvac-standards, hvac-knowledge, brand-guide...), `memory_update` (luu fact moi vao lena-learned overlay) |
| Docs/Drive | `gdoc_create`, `drive_list` (default folder STARDUCT), `drive_download` |
| Task | `task_add`, `task_overdue`, `task_status`, `task_update` |
| Zalo OA | `zalo_oa_send_to_vip` (tin rieng), `zalo_oa_history`, `zalo_oa_article` (dang bai public) |
| Content | `gemini_write` (FREE), `image_overlay` |
| System | `github_create_issue`, `kpi_update` |

## Skill files (workflow phuc tap — `skills/`)
`email-scan.md` `/email` · `weekly-report.md` `/baocao` · `kpi-dashboard.md` `/kpi` · `khkd-variance.md` `/khkd` · `npp-tracker.md` `/npp` · `climanexus-export.md` `/climanexus` `/export` · `sunday-meeting-prep.md` `/lich` · `dept-reminder.md` (cron CN 21h)

## 13 cron job tu dong
8h30 T2-T7 Calendar Briefing · 9h T2-T7 NPP Scan · 9h T2 PKD Team · 9h30 T2 Weekly Business Report · 9h30 T2-T7 Task Overdue · 17h T2-T7 TCKT Triage + Email Triage · 8h T3 Meeting Minutes · 21h30 T7 Email Scan Sep · 21h T7 Report Scan + luu Sheet · 21h CN Report Reminder · 22h T7 KPI Update · 21h cuoi thang Monthly Closing.

Chi tiet content tung cron → `cron-jobs.json`.

## Gotcha da verify (xem memory de tranh debug lai)
- Zalo OA article schema, Drive URL format, token rotation 3 layer → `memory/zalo_oa_api_state.md`
