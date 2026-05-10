---
description: Hien thi KPI Dashboard NSCA/STARDUCT thang hien tai
---
Thuc thi skill kpi-dashboard theo skills/kpi-dashboard.md.
1. !date "+%A %d/%m/%Y %H:%M %Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KPI Tracker!A:Z"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KHKD 2026 Baseline!A:Z"
4. Traffic Light: >=100% xanh | 80-99% vang | <80% do
