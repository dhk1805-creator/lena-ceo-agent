FROM node:24-slim

WORKDIR /app

# Install git + Vietnamese fonts (required for image-overlay text rendering)
RUN apt-get update && apt-get install -y git fonts-noto-core fonts-noto-cjk fontconfig && rm -rf /var/lib/apt/lists/* && fc-cache -fv

# Install OpenClaw globally — PINNED version (no @latest gambling)
# To upgrade: change version here, test, push.
RUN npm install -g openclaw@2026.4.29

# Install sharp + express + http-proxy-middleware locally in /app
RUN cd /app && npm install sharp express http-proxy-middleware

# Copy agent files to staging area (start.sh syncs to volume at runtime)
RUN mkdir -p /app/workspace/skills /app/workspace/memory
COPY AGENTS.md /app/workspace/AGENTS.md
COPY MEMORY.md /app/workspace/MEMORY.md
COPY memory/ /app/workspace/memory/
COPY skills/ /app/workspace/skills/
COPY cron-jobs.json /app/cron-jobs.json

# Copy Google API tools
COPY google-tools/gmail-read.js /app/google-tools/gmail-read.js
COPY google-tools/gmail-send.js /app/google-tools/gmail-send.js
COPY google-tools/sheets-read.js /app/google-tools/sheets-read.js
COPY google-tools/sheets-write.js /app/google-tools/sheets-write.js
COPY google-tools/calendar-read.js /app/google-tools/calendar-read.js
COPY google-tools/calendar-create.js /app/google-tools/calendar-create.js
COPY google-tools/gdoc-create.js /app/google-tools/gdoc-create.js
COPY google-tools/gdoc-export.js /app/google-tools/gdoc-export.js
COPY google-tools/gmail-attachment.js /app/google-tools/gmail-attachment.js
COPY google-tools/import-cron.js /app/google-tools/import-cron.js
COPY google-tools/facebook-post.js /app/google-tools/facebook-post.js
COPY google-tools/gpt-respond.js /app/google-tools/gpt-respond.js
COPY google-tools/drive-list.js /app/google-tools/drive-list.js
COPY google-tools/drive-download.js /app/google-tools/drive-download.js
COPY google-tools/gemini-analyze.js /app/google-tools/gemini-analyze.js
COPY google-tools/dalle-generate.js /app/google-tools/dalle-generate.js
COPY google-tools/npp-order-log.js /app/google-tools/npp-order-log.js
COPY google-tools/gemini-write.js /app/google-tools/gemini-write.js
COPY google-tools/image-overlay.js /app/google-tools/image-overlay.js
COPY google-tools/zalo-oa-send.js /app/google-tools/zalo-oa-send.js
COPY google-tools/zalo-oa-refresh-token.js /app/google-tools/zalo-oa-refresh-token.js
COPY google-tools/github-issue.js /app/google-tools/github-issue.js

# Copy brand assets (logos)
COPY assets/ /app/assets/

# Copy public static files (Zalo domain verification, etc.)
COPY public/ /app/public/

# Copy proxy server (serves /public/* + proxies rest to OpenClaw)
COPY proxy.js /app/proxy.js

# NOTE: Do NOT bake Zalo credentials into image!
# Credentials belong on persistent volume only (pair once, stays forever).
# Baking creds into image is a time bomb — expired sessions get replaced by stale creds.

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
