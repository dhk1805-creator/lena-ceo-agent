# Lena Claude Code Setup — chay trong D:\Projects\lena-ceo-agent
$r = $PWD.Path
New-Item -ItemType Directory -Force "$r\.claude\commands" | Out-Null
New-Item -ItemType Directory -Force "$r\.claude\agents" | Out-Null
"email-scan","weekly-report","kpi-dashboard","khkd-variance","npp-tracker","climanexus-export","dept-reminder","sunday-meeting-prep" | ForEach-Object { New-Item -ItemType Directory -Force "$r\.claude\skills\$_" | Out-Null }

# settings.json
@'
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Skill","Read","Edit","Write",
      "Bash(git status:*)","Bash(git diff:*)","Bash(git log:*)","Bash(git branch:*)",
      "Bash(git add:*)","Bash(git commit:*)","Bash(git push:*)","Bash(git pull:*)",
      "Bash(git fetch:*)","Bash(git checkout:*)","Bash(git restore:*)","Bash(git stash:*)",
      "Bash(git remote:*)","Bash(git rev-parse:*)","Bash(npm install:*)","Bash(npm run:*)",
      "Bash(npm test:*)","Bash(node google-tools/*)","Bash(date:*)","Bash(ls:*)",
      "Bash(cat:*)","Bash(grep:*)","Bash(rg:*)","Bash(find:*)","Bash(pwd)","Bash(tree:*)"
    ],
    "deny": [
      "Bash(rm -rf:*)","Bash(git push --force:*)","Bash(git reset --hard:*)",
      "Read(./.env)","Read(./google-tools/get-token.js)"
    ]
  },
  "env": { "TZ": "Asia/Ho_Chi_Minh" }
}
'@ | Set-Content -Encoding UTF8 "$r\.claude\settings.json"

# package.json
@'
{
  "name": "lena-ceo-agent",
  "version": "1.0.0",
  "private": true,
  "description": "Dao Thi Le Na - AI Executive Assistant for NSCA/STARDUCT CEO",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "email": "node google-tools/gmail-read.js",
    "calendar": "node google-tools/calendar-read.js",
    "sheets": "node google-tools/sheets-read.js",
    "test:env": "node -e \"['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN','GOOGLE_SHEET_ID','CLAUDE_API_KEY'].forEach(k=>console.log(k+': '+(process.env[k]?'OK':'MISSING')))\"",
    "test:gmail": "node google-tools/gmail-read.js 1 3",
    "test:sheets": "node google-tools/sheets-read.js \"%GOOGLE_SHEET_ID%\" \"KPI Tracker!A1:E5\""
  },
  "dependencies": { "sharp": "^0.33.0" },
  "repository": { "type": "git", "url": "https://github.com/dhk1805-creator/lena-ceo-agent.git" }
}
'@ | Set-Content -Encoding UTF8 "$r\package.json"

# .gitignore
@'
.env
.env.local
*.tmp.*
node_modules/
*.log
google-tools/get-token.js
.claude/settings.local.json
.claude/projects/
.claude/sessions/
.claude/shell-snapshots/
.claude/backups/
.DS_Store
Thumbs.db
.vscode/
.idea/
*.token
*.pem
credentials/
'@ | Set-Content -Encoding UTF8 "$r\.gitignore"

# CLAUDE.md
@'
# CLAUDE.md - Le Na CEO Agent (Dev workspace)
> System prompt thuc te cua Le Na nam o AGENTS.md.

## Hai moi truong
| Moi truong | Chay o dau |
|---|---|
| Production (Le Na 24/7) | Railway (Docker, OpenClaw) |
| Dev (sua prompt, test) | Claude Code CLI tren may desktop |

## Doc bat buoc khi vao phien
1. AGENTS.md - system prompt day du (3 VIP, phan cong AI, email, Zalo, lich, bao cao)
2. MEMORY.md - long-term memory
3. memory/ - quy trinh chi tiet
4. skills/ - 8 skill chuan production

## Quy tac dev
- KHONG bia ngay/thang. Luon dung: date "+%A %d/%m/%Y %H:%M %Z"
- Sua skill -> test bang /email, /baocao, /kpi, /khkd, /npp, /climanexus, /export, /lich
- Nhanh claude/* -> PR vao main. KHONG push thang main.

## Chi phi token
- Sonnet 4: chi VIP + quyet dinh nhay cam
- Haiku 4.5: dashboard mac dinh
- Gemini Flash (free): viet email/bao cao dai
- Muc tieu: <$0.85/ngay
'@ | Set-Content -Encoding UTF8 "$r\CLAUDE.md"

# --- COMMANDS ---
@'
---
description: Quet inbox dhk@nsca.vn 24h, phan loai 3 cap (KHAN/QUAN TRONG/THUONG)
argument-hint: "[hours] [max] [query]"
---
Thuc thi skill email-scan theo skills/email-scan.md.
1. Lay gio hien tai: !date "+%A %d/%m/%Y %H:%M %Z"
2. Doc inbox: !node google-tools/gmail-read.js ${1:-24} ${2:-50} "${3:-to:dhk@nsca.vn}"
3. Phan loai 3 cap (KHAN CAP / QUAN TRONG / THUONG)
4. Tom tat moi email: Nguoi gui - Chu de - 1 dong - Action
KHONG tu tra loi. CEO quyet dinh.
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\email.md"

@'
---
description: Xem lich hen sap toi tren Calendar 3 VIP
argument-hint: "[days]"
---
1. !date "+%A %d/%m/%Y %H:%M %Z"
2. !node google-tools/calendar-read.js ${1:-7}
3. Tach 3 VIP: Sep Khanh / chi Hong / anh Ngoc
4. Highlight trung lich
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\lich.md"

@'
---
description: Tong hop bao cao tuan tu 11 BP
---
Thuc thi skill weekly-report theo skills/weekly-report.md.
1. !date "+%A %d/%m/%Y %H:%M %Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Report Tracker!A:F"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KPI Tracker!A:Z"
4. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Weekly Performance!A:Z"
NGUYEN TAC SO 1: KHONG BIA.
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\baocao.md"

@'
---
description: Hien thi KPI Dashboard NSCA/STARDUCT thang hien tai
---
Thuc thi skill kpi-dashboard theo skills/kpi-dashboard.md.
1. !date "+%A %d/%m/%Y %H:%M %Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KPI Tracker!A:Z"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KHKD 2026 Baseline!A:Z"
4. Traffic Light: >=100% xanh | 80-99% vang | <80% do
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\kpi.md"

@'
---
description: Phan tich variance KHKD 2026 vs thuc te (10 nganh hang)
---
Thuc thi skill khkd-variance theo skills/khkd-variance.md.
1. !date "+%A %d/%m/%Y %H:%M %Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KHKD 2026 Baseline!A:Z"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Variance Log!A:Z"
4. Highlight nganh variance >10%
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\khkd.md"

@'
---
description: Theo doi 5 NPP (NTK / GALAXY / VNMEP / IMP / MEPCO)
argument-hint: "[hours]"
---
Thuc thi skill npp-tracker theo skills/npp-tracker.md.
1. !node google-tools/npp-order-log.js ${1:-168}
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "NPP Tracker!A:Z"
3. Xep hang 5 NPP theo % dat KH. Highlight <80%.
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\npp.md"

@'
---
description: Bao cao ClimaNexus - KPI, milestone, pipeline goi von
---
Thuc thi phan ClimaNexus cua skill climanexus-export.
1. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "ClimaNexus KPI!A:Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "ClimaNexus Milestones!A:Z"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "ClimaNexus Pipeline!A:Z"
Bao mat: KHONG tiet lo gia, dieu khoan.
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\climanexus.md"

@'
---
description: Bao cao xuat khau quoc te (Santiago / EAL / Quiet Cool / Saudi)
---
Thuc thi phan Export cua skill climanexus-export.
1. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Export Revenue!A:Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Intl Pipeline!A:Z"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Santiago KPI!A:Z"
4. Highlight don hang lon >$50K, rui ro cham COD.
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\export.md"

@'
---
description: Chuan bi noi dung hop giao ban Thu 2 (cron CN 21:00)
---
Thuc thi skill sunday-meeting-prep theo skills/sunday-meeting-prep.md.
1. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Report Tracker!A:F"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Weekly Performance!A:Z"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KHKD 2026 Baseline!A:Z"
4. De xuat 3-5 noi dung CEO can quyet trong hop Thu 2.
'@ | Set-Content -Encoding UTF8 "$r\.claude\commands\hopgiaoban.md"

# --- SKILLS ---
@'
---
name: email-scan
description: Quet inbox dhk@nsca.vn 24h, phan loai KHAN CAP/QUAN TRONG/THUONG. Trigger /email hoac 7h sang.
---
Source of truth: skills/email-scan.md - DOC TRUOC khi thuc thi.
1. gmail-read.js [hours] [max] [query]
2. Phan loai 3 cap: do=khach hang/deadline, vang=14BP/bao cao, trang=thong bao
3. KHONG tu tra loi.
'@ | Set-Content -Encoding UTF8 "$r\.claude\skills\email-scan\SKILL.md"

@'
---
name: weekly-report
description: Tong hop bao cao tuan tu 11 BP, trinh CEO sang Thu 2. Trigger /baocao hoac cron.
---
Source of truth: skills/weekly-report.md
1. Doc Report Tracker + KPI Tracker + Weekly Performance
2. Liet ke DA NOP / CHUA NOP
3. NGUYEN TAC SO 1: KHONG BIA.
'@ | Set-Content -Encoding UTF8 "$r\.claude\skills\weekly-report\SKILL.md"

@'
---
name: kpi-dashboard
description: Tinh 10 KPI tong hop NSCA/STARDUCT thang hien tai. Trigger /kpi.
---
Source of truth: skills/kpi-dashboard.md
1. Doc KPI Tracker + KHKD Baseline + NPP Tracker + Export Revenue
2. Traffic Light: >=100% xanh | 80-99% vang | <80% do
'@ | Set-Content -Encoding UTF8 "$r\.claude\skills\kpi-dashboard\SKILL.md"

@'
---
name: khkd-variance
description: Phan tich variance KHKD 2026 (251.76 ty) vs thuc te 10 nganh hang. Trigger /khkd.
---
Source of truth: skills/khkd-variance.md
10 nganh: Cua gio ND/XK, Van EI ND/XK, Van co khi ND/XK, VAV/CAV, Tam nan, Thang cap, Khac
Highlight nganh variance >10%, de xuat hanh dong 3 nganh lon nhat.
'@ | Set-Content -Encoding UTF8 "$r\.claude\skills\khkd-variance\SKILL.md"

@'
---
name: npp-tracker
description: Theo doi 5 NPP noi dia (NTK/GALAXY/VNMEP/IMP/MEPCO). Trigger /npp.
---
Source of truth: skills/npp-tracker.md
NPP01=NTK(A-Bac) NPP02=GALAXY(B-Trung) NPP03=VNMEP(B-Nam) NPP04=IMP(C-HCM) NPP05=MEPCO(C-BD)
Xep hang theo % dat KH. Highlight <80%.
'@ | Set-Content -Encoding UTF8 "$r\.claude\skills\npp-tracker\SKILL.md"

@'
---
name: climanexus-export
description: Bao cao ClimaNexus (target $500K pre-seed) va xuat khau quoc te. Trigger /climanexus /export.
---
Source of truth: skills/climanexus-export.md
ClimaNexus: KPI/Milestones/Pipeline sheets | Drive: 1ngFR09u6b0ShSwSIGOfB0fWDb9AwQY5C
Export: Santiago, EAL, Quiet Cool (US), Saudi | Cert: UL/FM/AHRI880/AAMA
BAOMAT: KHONG tiet lo gia, dieu khoan voi ben thu 3.
'@ | Set-Content -Encoding UTF8 "$r\.claude\skills\climanexus-export\SKILL.md"

@'
---
name: dept-reminder
description: Nhac 14 BP nop bao cao deadline T6 17:00. Cron T5 09:00 (nhac truoc) + T6 14:00 (nhac gap).
---
Source of truth: skills/dept-reminder.md
1. Doc Report Tracker - ai da nop / chua nop
2. T5: gui TAT CA 14 BP email lich su
3. T6: gui CHI BP chua nop, email + Zalo
4. Sau T6 17:00: bao Sep Khanh ty le nop
'@ | Set-Content -Encoding UTF8 "$r\.claude\skills\dept-reminder\SKILL.md"

@'
---
name: sunday-meeting-prep
description: Chuan bi hop giao ban Thu 2. Trigger CN 21:00 cron hoac /hopgiaoban.
---
Source of truth: skills/sunday-meeting-prep.md
Target tuan = target thang / so Thu 2 trong thang
Traffic Light: >=100% xanh | 80-99% vang | <80% do
De xuat 3-5 noi dung CEO can quyet.
'@ | Set-Content -Encoding UTF8 "$r\.claude\skills\sunday-meeting-prep\SKILL.md"

# --- AGENTS ---
@'
---
name: email-writer
description: Soan email Viet/Anh duoi ten Le Na cho khach hang, doi tac, 14 BP. Dung khi email >150 ky tu. KHONG tu gui.
tools: Read, Write, Bash
model: haiku
---
Viet email duoi ten Le Na (Tro ly AI CEO Dao Huy Khanh).
Chu ky: "Tran trong, / Dao Thi Le Na / Tro ly AI CEO Dao Huy Khanh / lena@nsca.vn | Zalo: 0989407322"
Output: SUBJECT / TO / CC / ---BODY--- / [noi dung + chu ky]
KHONG tu gui.
'@ | Set-Content -Encoding UTF8 "$r\.claude\agents\email-writer.md"

@'
---
name: report-builder
description: Doc Sheets, tong hop so lieu, viet bao cao >300 tu. Tranh ton Sonnet main thread.
tools: Read, Write, Bash
model: haiku
---
NGUYEN TAC SO 1: CO DATA MOI VIET. KHONG skeleton/placeholder.
Thieu data -> ghi "[X]: chua co data, can lay tu Y". Chi viet khi >=80% data thuc.
Format: # BAO CAO [LOAI]-[KY]-[NGAY] / ## Tong quan / ## Chi tiet / ## Diem nhan / ## De xuat hanh dong
'@ | Set-Content -Encoding UTF8 "$r\.claude\agents\report-builder.md"

@'
---
name: sheets-analyst
description: Doc va phan tich Google Sheets (KPI/KHKD/NPP/Export/ClimaNexus). Tra ve insight ngan, KHONG raw data.
tools: Read, Bash
model: haiku
---
20 sheet: CEO Daily Dashboard, KPI Tracker, Meeting Notes, Market Research, Email Action Log,
Report Tracker, Attachment Analysis, Activity Log, KHKD 2026 Baseline, NPP Tracker,
Variance Log, ClimaNexus KPI, ClimaNexus Milestones, ClimaNexus Pipeline, Export Revenue,
Intl Pipeline, Santiago KPI, Intl Market Log, Weekly Performance, NPP Orders
Output: SHEET/RANGE/ROWS + KEY NUMBERS (3-5) + INSIGHTS (2-3) + ANOMALIES
KHONG copy raw rows, KHONG bia, KHONG ghi sheet.
'@ | Set-Content -Encoding UTF8 "$r\.claude\agents\sheets-analyst.md"

Write-Host "=== XONG! Kiem tra cac file ===" -ForegroundColor Green
Get-ChildItem "$r\.claude" -Recurse -File | Measure-Object | Select-Object -ExpandProperty Count | ForEach-Object { Write-Host "$_ files trong .claude/" }
Write-Host "Chay tiep: git add . && git commit -m 'Setup Claude Code dev env' && git push" -ForegroundColor Cyan
