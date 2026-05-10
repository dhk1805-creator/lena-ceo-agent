---
description: Tong hop bao cao tuan tu 11 BP
---
Thuc thi skill weekly-report theo skills/weekly-report.md.
1. !date "+%A %d/%m/%Y %H:%M %Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Report Tracker!A:F"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KPI Tracker!A:Z"
4. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Weekly Performance!A:Z"
NGUYEN TAC SO 1: KHONG BIA.
