FROM node:24-slim

WORKDIR /app

# Install git + Vietnamese fonts (required for image-overlay text rendering) + curl (for yt-dlp download)
RUN apt-get update && apt-get install -y git curl ca-certificates fonts-noto-core fonts-noto-cjk fontconfig && rm -rf /var/lib/apt/lists/* && fc-cache -fv

# Install yt-dlp (standalone binary, khong can Python) — web-read.js dung de lay transcript video YouTube
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version

# Install OpenClaw globally — PINNED version (no @latest gambling)
# To upgrade: change version here, test, push.
RUN npm install -g openclaw@2026.4.29

# Install sharp + express + http-proxy-middleware locally in /app
RUN cd /app && npm install sharp express http-proxy-middleware

# Copy agent files to staging area (start.sh syncs to volume at runtime)
RUN mkdir -p /app/workspace/skills /app/workspace/memory
COPY AGENTS.md /app/workspace/AGENTS.md
# MEMORY.md đã được gỡ khỏi repo (trùng lặp với các file trong memory/) —
# proxy.js không dùng tới file này. Cả thư mục memory/ vẫn được copy đầy đủ.
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
