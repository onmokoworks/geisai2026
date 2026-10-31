# geisai2026

芸祭2026 で展示する [wadalab-motion](https://github.com/onmokoworks/wadalab-motion) の展示用ページです。21:9 の画面に出して使います。

左の 5/21 に操作説明と QR、右の 16/21 に試打の画面を出します。放置すると説明文が Wadamotion-4 の動きで流れ、キーを押すと試打に戻ります。打った文字は Cloudflare Workers AI の Clef-flash で判定し、卑猥語や暴言だったら消します。

## 公開版（Cloudflare Pages）

展示の Mac では公開 URL をブラウザで開くだけです。判定は Pages Functions（`functions/api/moderate.js`）から Workers AI のバインディングで呼ぶので、API トークンは要りません。

```sh
npx wrangler@4 login   # 初回だけ
npm run deploy
```

`npm run build` で wadalab-motion を取ってきて `dist/` にまとめ、`wrangler pages deploy` で上げます。Git の push だけではデプロイされません。

判定 API は展示ページと同じオリジンからの呼び出しだけを受け付けます。消した文字は Pages のログ（`npx wrangler@4 pages deployment tail`）に出ます。

## ローカル版（回線が不安なとき）

```sh
cp .env.example .env   # Workers AI のアカウント ID とトークンを書く
npm start
```

[http://127.0.0.1:4326/](http://127.0.0.1:4326/) を開きます。初回は wadalab-motion のデータ（約 10MB）を GitHub から取ってくるので、ネット回線が必要です。`.env` がなくても動きますが、その場合は文字の判定をしません。

## 調整

- `?idle=10`：放置して説明文に戻るまでの秒数（既定は 30 秒）
- 判定の質問としきい値：`lib/moderation.mjs`（公開版とローカル版で共通）
- 判定に失敗しても、展示はそのまま続きます

## ライセンス

このリポジトリのコードは [MIT ライセンス](LICENSE)です。wadalab-motion のコード・文字データ・フォントはビルド時に取ってくるだけで、このリポジトリには含めていません。それぞれの条件は wadalab-motion 側を参照してください。
