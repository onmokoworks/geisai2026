# geisai2026

芸祭2026 で展示する [wadalab-motion](https://github.com/onmokoworks/wadalab-motion) の展示用ページです。21:9 の画面に出し、展示用の Mac 上で動かします。

左の 5/21 に操作説明と QR、右の 16/21 に試打の画面を出します。放置すると説明文が Wadamotion-4 の動きで流れ、キーを押すと試打に戻ります。打った文字は Cloudflare Workers AI の Clef-flash で判定し、卑猥語や暴言だったら消します。

## 起動

Node.js 20 以降が必要です。

```sh
cp .env.example .env   # Workers AI のアカウント ID とトークンを書く
npm start
```

[http://127.0.0.1:4326/](http://127.0.0.1:4326/) を開いて全画面にします。初回は wadalab-motion のデータ（約 10MB）を GitHub から取ってくるので、ネット回線が必要です。

`.env` がなくても動きます。その場合は文字の判定をしません。判定に失敗しても、展示はそのまま続きます。

- `?idle=10`：放置して説明文に戻るまでの秒数（既定は 30 秒）
- `PORT=4400 npm start`：ポートを変える

消した文字は、判定の確率と一緒にサーバーのログに出ます。しきい値は `server.mjs` の `thresholds` で変えられます。

## ライセンス

このリポジトリのコードは [MIT ライセンス](LICENSE)です。wadalab-motion のコード・文字データ・フォントは `vendor/` に取ってくるだけで、このリポジトリには含めていません。それぞれの条件は wadalab-motion 側を参照してください。
