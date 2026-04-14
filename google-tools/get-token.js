// Get Google OAuth Refresh Token — Run once locally
const http = require('http');
const { URL } = require('url');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) { console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars'); process.exit(1); }
const REDIRECT_URI = 'http://localhost:3333/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents'
].join(' ');

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3333');
  if (url.pathname === '/callback' && url.searchParams.get('code')) {
    const code = url.searchParams.get('code');

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenRes.json();

    if (tokens.refresh_token) {
      console.log('\n========================================');
      console.log('SUCCESS! Copy this refresh token:');
      console.log('========================================');
      console.log(tokens.refresh_token);
      console.log('========================================');
      console.log('\nRun this command in PowerShell:');
      console.log(`railway variables set GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
      console.log('========================================\n');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>✅ Success!</h1><p>Refresh token đã hiện trong terminal. Bạn có thể đóng tab này.</p>');
    } else {
      console.log('Error:', JSON.stringify(tokens, null, 2));
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>❌ Error</h1><pre>' + JSON.stringify(tokens, null, 2) + '</pre>');
    }

    setTimeout(() => process.exit(0), 2000);
  }
});

server.listen(3333, () => {
  console.log('\n=== Google OAuth Authorization ===');
  console.log('Mở link này trong trình duyệt:\n');
  console.log(authUrl);
  console.log('\n(Đăng nhập bằng dhk@nsca.vn hoặc dhk1805@gmail.com)');
});
