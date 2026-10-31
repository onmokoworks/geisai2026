// Cloudflare Pages に上げる dist/ を作る。public/ に wadalab-motion を /workspace/wadalab-motion/ として重ねる。
import {cp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const root = new URL('../', import.meta.url);
execFileSync(process.execPath, [new URL('scripts/prepare.mjs', root).pathname], {stdio: 'inherit'});
await rm(new URL('dist/', root), {recursive: true, force: true});
await cp(new URL('public/', root), new URL('dist/', root), {recursive: true});
await cp(new URL('vendor/wadalab-motion/', root), new URL('dist/workspace/wadalab-motion/', root), {recursive: true});
console.log('dist/ を作りました');
