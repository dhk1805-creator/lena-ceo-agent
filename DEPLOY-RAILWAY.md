# DEPLOY LE NA LEN RAILWAY - 5 PHUT

## Buoc 1: Push len GitHub

```bash
cd openclaw
git init
git add .
git commit -m "Le Na CEO Agent - OpenClaw"
git remote add origin https://github.com/YOUR_USERNAME/lena-ceo-agent.git
git push -u origin main
```

## Buoc 2: Deploy Railway

1. Vao https://railway.com → **New Project** → **Deploy from GitHub**
2. Chon repo `lena-ceo-agent`
3. Railway tu dong detect Dockerfile va deploy

## Buoc 3: Them Environment Variables

Railway Dashboard → Service → **Variables** → Add:

| Variable | Value |
|----------|-------|
| `CLAUDE_API_KEY` | `sk-ant-xxxxx` |
| `OPENAI_API_KEY` | `sk-xxxxx` (tuy chon) |
| `GEMINI_API_KEY` | `xxxxx` (tuy chon) |
| `GOOGLE_SHEET_ID` | `xxxxx` |
| `TZ` | `Asia/Ho_Chi_Minh` |

## Buoc 4: Custom Domain (Cloudflare)

1. Railway Dashboard → Service → **Settings** → **Networking** → **Generate Domain**
2. Copy Railway domain: `lena-xxx.up.railway.app`
3. Vao Cloudflare Dashboard → DNS → Add Record:
   - Type: **CNAME**
   - Name: `lena` (hoac `ai`)
   - Target: `lena-xxx.up.railway.app`
   - Proxy: ON

Ket qua: `https://lena.your-domain.com` → OpenClaw Gateway

## Buoc 5: Ket noi Zalo

Sau khi deploy, truy cap:
```
https://lena.your-domain.com/webchat
```
Hoac pair Zalo qua CLI:
```bash
railway run openclaw channel pair zalo
```

## Chi phi Railway

- **Trial**: $5 free credit
- **Hobby**: $5/thang (du cho Le Na)
- **Pro**: $20/thang (neu can nhieu hon)

Le Na can khoang 512MB RAM, chay 24/7 → ~$5/thang
