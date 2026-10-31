// Cloudflare Pages 上の /api/moderate。Workers AI のバインディング（wrangler.toml の AI）で判定する。
import {judge, maxLength, model, request as moderationRequest} from '../../lib/moderation.mjs';

export async function onRequestPost({request, env}) {
  // 公開 URL なので、展示ページ以外からの呼び出しは断る。
  if (request.headers.get('Origin') !== new URL(request.url).origin) return new Response('forbidden', {status: 403});
  try {
    const text = String((await request.json()).text ?? '').slice(0, maxLength);
    if (!text.trim()) return Response.json({flagged: false});
    const judgment = judge((await env.AI.run(model, moderationRequest(text))).answers);
    if (judgment.flagged) console.log('消去:', text, JSON.stringify(judgment.scores));
    return Response.json(judgment);
  } catch (error) {
    console.warn('判定に失敗:', error.message);
    return Response.json({error: error.message}, {status: 502});
  }
}
