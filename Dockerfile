FROM node:24-slim

WORKDIR /app

# Install git + Vietnamese fonts (required for image-overlay text rendering) + curl
RUN apt-get update && apt-get install -y git curl ca-certificates fonts-noto-core fonts-noto-cjk fontconfig antiword && rm -rf /var/lib/apt/lists/* && fc-cache -fv

# Install yt-dlp (standalone binary) — web-read.js uses to get YouTube transcripts
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version

# Install dependencies: sharp (image), express (server), node-cron (scheduler)
RUN cd /app && npm install sharp express node-cron xlsx pdf-parse mammoth

# Copy workspace files
RUN mkdir -p /app/workspace/skills /app/workspace/memory
COPY AGENTS.md /app/workspace/AGENTS.md
COPY memory/ /app/workspace/memory/
COPY skills/ /app/workspace/skills/
COPY cron-jobs.json /app/cron-jobs.json

# Copy Google API tools
COPY google-tools/ /app/google-tools/

# Copy brand assets (logos)
COPY assets/ /app/assets/

# Copy public static files (Zalo domain verification, etc.)
COPY public/ /app/public/

# Copy server
COPY proxy.js /app/proxy.js

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
