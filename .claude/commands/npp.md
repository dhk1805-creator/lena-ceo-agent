---
description: Theo doi 5 NPP (NTK / GALAXY / VNMEP / IMP / MEPCO)
argument-hint: "[hours]"
---
Thuc thi skill npp-tracker theo skills/npp-tracker.md.
1. !node google-tools/npp-order-log.js ${1:-168}
2. !node google-tools/sheets-read.js "$GOOGLE_SHEET_ID" "NPP Tracker!A:Z"
3. Xep hang 5 NPP theo % dat KH. Highlight <80%.
