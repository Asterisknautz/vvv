# vvv

Three.js と Vite で小さな Web 表現を試すための実験場です。

## 使い方

```bash
npm install
npm run dev
```

- `/` はホーム
- `/001` から `/999` は `src/ideas/{id}.ts` を動的に読み込む実験ページ
- 存在しない ID はホーム相当にフォールバック

## ディレクトリ

```text
.
├─ src/            実行される Web アプリのソース
│  └─ ideas/       3 桁 ID ごとの実験モジュール
├─ experiments/    実験ごとの仕様、プロンプト、非公開寄りの設定メモ
├─ public/         ビルド後もそのまま公開される静的アセット
├─ docs/           リポジトリ運用、設計、調査メモ
│  └─ archive/     古いセットアップメモや履歴資料
├─ reports/        ビルド分析などの生成レポート
└─ dist/           Vite のビルド成果物
```

## 実験の追加

1. `src/ideas/006.ts` のように 3 桁 ID のモジュールを作る。
2. 必要な仕様や生成メモは `experiments/006_短い説明.yaml` などに置く。
3. 公開したい画像、モデル、フォントだけを `public/` に置く。
4. ナビゲーションに常設したい場合は `index.html` のリンクを追加する。

`src/ideas/*.ts` は `SceneContext` を受け取り、必要ならクリーンアップ関数を返します。

## コマンド

- `npm run dev`: 開発サーバー
- `npm run typecheck`: TypeScript チェック
- `npm run build`: 型チェックと本番ビルド
- `npm run preview`: ビルド結果のプレビュー

バンドル分析は `npm run build` 時に `reports/build/bundle-stats.html` へ出力されます。
