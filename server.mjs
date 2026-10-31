// 芸祭の展示機で動かすローカルサーバー。
// public/ と、scripts/prepare.mjs が取ってきた vendor/wadalab-motion/ を配信し、
// /api/moderate で Clef-flash（Workers AI）に卑猥語と暴言の判定を中継する。
// CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_AUTH_TOKEN（Workers AI の権限）は .env に置く（ブラウザには渡さない）。
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';

const root = new URL('./', import.meta.url).pathname;
const vendor = '/workspace/wadalab-motion/';
const port = Number(process.env.PORT) || 4326;
const env = Object.fromEntries((await readFile(join(root, '.env'), 'utf8').catch(() => '')).split('\n')
  .map(line => line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')]));
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_AUTH_TOKEN || env.CLOUDFLARE_AUTH_TOKEN;
if (!accountId || !apiKey) console.warn('CLOUDFLARE_ACCOUNT_ID か CLOUDFLARE_AUTH_TOKEN がないので、卑猥語の判定はせずに配信だけします。');

const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'};

// 「殺陣」「死にますと云う」が abusive で 0.6 前後になるので、そこだけ 0.7 にする。
const thresholds = {lewd: .5, disguised: .5, abusive: .7};

async function moderate(text) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef-flash`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    signal: AbortSignal.timeout(4000),
    body: JSON.stringify({
      model: 'clef-flash',
      state: {text},
      questions: {
        // "obscene" だと「バカ」「ゴミ」まで拾うので、性的なものに限って聞く。
        lewd: {type: 'noul', instructions: 'Is `text` sexual? Does it refer to sex, genitals, breasts, masturbation, or erotic content, including words like エロ or えろい, slang, euphemisms, and spellings split or disguised with spaces, kana, kanji, romaji, or symbols such as ○ or π? Plain insults that are not sexual do not count.'},
        // 一つの質問だと崩した表記の確率が低く出るので、別に聞いて高いほうを使う。
        disguised: {type: 'noul', instructions: 'Does `text` contain an obscene word, such as a word for genitals or sex, written with spaces, ○, ×, *, or other symbols inserted between or replacing some of its letters?'},
        // 当て字（氏ね・4ね）は字面では拾えず、読みで判断させると拾える。
        abusive: {type: 'noul', instructions: 'Japanese internet users often disguise abusive words by writing them with different characters that have the same pronunciation (for example 氏ね, 4ね, and 市ね are all read しね and mean 死ね). Read `text` by its pronunciation. Does it, read aloud, tell someone to die or threaten to kill or hurt someone?'},
      },
    }),
  });
  const {success, result, errors} = await response.json();
  if (!response.ok || !success) throw new Error(`Clef-flash ${response.status} ${JSON.stringify(errors)}`);
  const probability = answer => typeof answer === 'number' ? answer : answer?.noul ?? 0;
  const scores = Object.fromEntries(Object.keys(thresholds).map(id => [id, probability(result.answers?.[id])]));
  return {scores, flagged: Object.entries(thresholds).some(([id, threshold]) => scores[id] >= threshold)};
}

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/api/moderate' && request.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of request) { body += chunk; if (body.length > 20000) throw new Error('too long'); }
      const text = String(JSON.parse(body).text ?? '').slice(0, 2000);
      const judgment = accountId && apiKey && text.trim() ? await moderate(text) : {flagged: false};
      if (judgment.flagged) console.log('消去:', text, JSON.stringify(judgment.scores));
      response.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify(judgment));
    } catch (error) {
      console.warn('判定に失敗:', error.message);
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
