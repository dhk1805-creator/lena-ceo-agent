FROM node:24-slim

WORKDIR /app

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Create workspace directories
RUN mkdir -p /root/.openclaw/workspace /root/.openclaw/agents/main/sessions

# Copy agent files
COPY AGENTS.md /root/.openclaw/workspace/AGENTS.md
COPY MEMORY.md /root/.openclaw/workspace/MEMORY.md
COPY skills/ /root/.openclaw/workspace/skills/
COPY cron-jobs.json /app/cron-jobs.json

# Copy Zalo session (login credentials from local machine)
RUN mkdir -p /root/.openclaw/credentials/zalouser
COPY zalo-session/credentials.json /root/.openclaw/credentials/zalouser/credentials.json
COPY zalo-session/zalouser-pairing.json /root/.openclaw/credentials/zalouser-pairing.json

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
