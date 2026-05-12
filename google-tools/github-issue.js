#!/usr/bin/env node
require('./_env');
// GitHub Issue Creator — Lê Na gửi yêu cầu sửa code/cron
// Usage: node github-issue.js "<title>" "<body>" "<requester>"
// Env: GITHUB_TOKEN, GITHUB_REPO (default: dhk1805-creator/lena-ceo-agent)

const title = process.argv[2];
const body = process.argv[3];
const requester = process.argv[4] || 'CEO';

if (!title || !body) {
  console.error('Usage: node github-issue.js "<title>" "<body>" "<requester>"');
  process.exit(1);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'dhk1805-creator/lena-ceo-agent';

if (!GITHUB_TOKEN) {
  console.log(JSON.stringify({
    success: false,
    error: 'GITHUB_TOKEN env var chua set. Chay: railway variables set GITHUB_TOKEN="ghp_xxx"'
  }));
  process.exit(1);
}

async function createIssue() {
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const issueBody = [
    `## Yeu cau tu Le Na AI`,
    ``,
    `**Nguoi yeu cau:** ${requester}`,
    `**Thoi gian:** ${now}`,
    ``,
    `### Noi dung`,
    body,
    ``,
    `---`,
    `*Issue nay duoc tao tu dong boi Dao Thi Le Na — Tro ly AI CEO NSCA*`
  ].join('\n');

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `[Le Na] ${title}`,
      body: issueBody
    })
  });

  const data = await res.json();

  if (data.number) {
    console.log(JSON.stringify({
      success: true,
      issue_number: data.number,
      url: data.html_url,
      title: data.title
    }));
  } else {
    console.log(JSON.stringify({
      success: false,
      error: data.message || 'Failed to create issue',
      status: res.status
    }));
    process.exit(1);
  }
}

createIssue().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
});
