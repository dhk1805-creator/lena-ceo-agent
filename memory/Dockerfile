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
# MEMORY.md đọc ngay tại memory/ (không cần chuyển ra thư mục gốc)
COPY memory/MEMORY.md /app/workspace/MEMORY.md
COPY memory/ /app/workspace/memory/
COPY skills/ /app/workspace/skills/
COPY cron-jobs.json /app/cron-jobs.json

# Copy ALL Google API tools (directory COPY prevents missing-file bugs)
COPY google-tools/ /app/google-tools/

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
