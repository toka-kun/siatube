# SiaTube 展開手順

このファイルは、SiaTube をローカルで確認してから公開環境へ展開するための手順です。

## 前提

- Node.js 20 以上
- npm 11 以上
- Cloudflare Workers へ展開する場合は Wrangler が使えること
- Google Apps Script 版を更新する場合は、GAS の編集権限があること

## 構成

| 用途 | ファイル |
|---|---|
| フロントエンド | `client/` |
| ローカル/Node サーバー | `server/index.js` |
| Cloudflare Workers | `worker.js`, `wrangler.toml` |
| GAS で読み込む HTML | `index.html.txt` |
| API 仕様 | `API_DOCUMENTATION.md` |

## 1. 依存関係をインストールする

初回、または `package-lock.json` が更新された後に実行します。

```bash
npm install
```

ルートの `postinstall` により、`client/` 側の依存関係インストールとビルドも実行されます。

## 2. ローカルで開発確認する

フロントエンドだけを Vite で確認する場合:

```bash
npm run dev
```

`client/vite.config.js` では `/api` が `https://siatube.com` にプロキシされます。

Express サーバー込みで確認する場合:

```bash
npm start
```

標準では `http://localhost:5000` で起動します。ポートを変える場合は `PORT` を指定します。

```bash
PORT=3000 npm start
```

## 3. フロントエンドをビルドする

公開前に必ずビルドします。

```bash
npm run build --prefix client
```

ビルド結果は `client/dist/` に作成されます。