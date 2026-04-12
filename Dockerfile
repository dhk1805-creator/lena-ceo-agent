FROM node:24-slim

WORKDIR /app

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Copy agent files to staging area (start.sh syncs to volume at runtime)
RUN mkdir -p /app/workspace/skills
COPY AGENTS.md /app/workspace/AGENTS.md
COPY MEMORY.md /app/workspace/MEMORY.md
COPY skills/ /app/workspace/skills/
COPY cron-jobs.json /app/cron-jobs.json

# Copy Google API tools
COPY google-tools/gmail-read.js /app/google-tools/gmail-read.js
COPY google-tools/gmail-send.js /app/google-tools/gmail-send.js
COPY google-tools/sheets-read.js /app/google-tools/sheets-read.js
COPY google-tools/sheets-write.js /app/google-tools/sheets-write.js
COPY google-tools/calendar-read.js /app/google-tools/calendar-read.js
COPY google-tools/import-cron.js /app/google-tools/import-cron.js

# Copy Zalo session to staging (start.sh copies to volume if not exists)
RUN mkdir -p /app/zalo-session
COPY zalo-session/credentials.json /app/zalo-session/credentials.json
COPY zalo-session/zalouser-pairing.json /app/zalo-session/zalouser-pairing.json

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
