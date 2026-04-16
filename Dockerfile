FROM node:24-slim

WORKDIR /app

# Install git (required by openclaw)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally
RUN npm install -g openclaw@latest

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

# Copy brand assets (logos)
COPY assets/ /app/assets/

# Copy Zalo session to staging (start.sh copies to volume if not exists)
RUN mkdir -p /app/zalo-session
COPY zalo-session/credentials.json /app/zalo-session/credentials.json
COPY zalo-session/zalouser-pairing.json /app/zalo-session/zalouser-pairing.json

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
