---
description: Bao cao xuat khau quoc te (Santiago / EAL / Quiet Cool / Saudi)
---
Thuc thi phan Export cua skill climanexus-export.
1. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Export Revenue!A:Z"
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Intl Pipeline!A:Z"
3. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "Santiago KPI!A:Z"
4. Highlight don hang lon >$50K, rui ro cham COD.
