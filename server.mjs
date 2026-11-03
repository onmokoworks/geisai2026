// 回線が不安なとき用のローカルサーバー（本番は Cloudflare Pages）。
// public/ と、scripts/prepare.mjs が取ってきた vendor/wadalab-motion/ を配信し、
// /api/moderate で Clef-flash（Workers AI の REST）に卑猥語と暴言の判定を中継する。
// CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_AUTH_TOKEN（Workers AI の権限）は .env に置く（ブラウザには渡さない）。
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {judge, maxLength, model, request as moderationRequest} from './lib/moderation.mjs';

const root = new URL('./', import.meta.url).pathname;
const vendor = '/workspace/wadalab-motion/';
const port = Number(process.env.PORT) || 4326;
const env = Object.fromEntries((await readFile(join(root, '.env'), 'utf8').catch(() => '')).split('\n')
  .map(line => line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')]));
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_AUTH_TOKEN || env.CLOUDFLARE_AUTH_TOKEN;
if (!accountId || !apiKey) console.warn('CLOUDFLARE_ACCOUNT_ID か CLOUDFLARE_AUTH_TOKEN がないので、卑猥語の判定はせずに配信だけします。');

const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'};

// 会場の回線は途切れやすいので、失敗したら 1 回だけやり直す。
async function moderate(text, retry = true) {
  try {
    return await request(text);
  } catch (error) {
    if (!retry) throw error;
    await new Promise(resolve => setTimeout(resolve, 500));
    return moderate(text, false);
  }
}

async function request(text) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    signal: AbortSignal.timeout(6000),
    body: JSON.stringify(moderationRequest(text)),
  });
  const {success, result, errors} = await response.json();
  if (!response.ok || !success) throw new Error(`Clef-flash ${response.status} ${JSON.stringify(errors)}`);
  return judge(result.answers);
}

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/api/moderate' && request.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of request) { body += chunk; if (body.length > 20000) throw new Error('too long'); }
      const text = String(JSON.parse(body).text ?? '').slice(0, maxLength);
      const judgment = accountId && apiKey && text.trim() ? await moderate(text) : {flagged: false};
      if (judgment.flagged) console.log(new Date().toLocaleTimeString('ja-JP'), '消去:', text, JSON.stringify(judgment.scores));
      response.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify(judgment));
    } catch (error) {
      console.warn(new Date().toLocaleTimeString('ja-JP'), '判定に失敗:', error.message);
      response.writeHead(502, {'Content-Type': 'application/json'}).end(JSON.stringify({error: error.message}));
    }
    return;
  }
  const pathname = decodeURIComponent(url.pathname);
  const base = join(root, pathname.startsWith(vendor) ? 'vendor/wadalab-motion' : 'public');
  let path = normalize(join(base, pathname.startsWith(vendor) ? pathname.slice(vendor.length) : pathname));
  if (!path.startsWith(base)) { response.writeHead(403).end(); return; }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    const data = await readFile(path);
    response.writeHead(200, {'Content-Type': types[extname(path)] ?? 'application/octet-stream'}).end(data);
  } catch {
    response.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
