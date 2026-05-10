---
description: Phan tich variance KHKD 2026 vs thuc te (10 nganh hang)
---
Thuc thi skill khkd-variance theo skills/khkd-variance.md.
1. !date "+%A %d/%m/%Y %H:%M %Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "KHKD 2026 Baseline!A:Z"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Variance Log!A:Z"
4. Highlight nganh variance >10%
