# AGENTS

このリポジトリは、Three.js / Vite の Web 実験場として扱う。

## 作業前

- 作業開始時に `pwd` を確認する。
- Git 管理下では `git rev-parse --show-toplevel` で対象リポジトリを確認する。
- 変更前に対象ファイルまたは対象ディレクトリを明示する。
- 返答は日本語を基本にする。

## 置き場所

- `src/`: 実行されるアプリコード。
- `src/ideas/`: `/001` のような 3 桁ルートに対応する実験モジュール。
- `experiments/`: 実験ごとの仕様、プロンプト、設定メモ。公開ファイルではない前提で置く。
- `public/`: URL から直接公開される静的アセットだけを置く。
- `docs/`: 運用、設計、調査、レポート類。
- `reports/`: ビルド分析などの生成レポート。
- `dist/`: ビルド成果物。手編集しない。

## ドキュメント命名

進捗、レポート、調査、設計メモの Markdown は `YYMMDD_日本語で内容が分かる短い説明.md` にする。`README.md` と `AGENTS.md` は例外。

## 実装方針

- 既存の Vite + vanilla TypeScript + Three.js 構成を優先する。
- 共有の描画基盤は `src/threeScene.ts` に寄せ、個別表現は `src/ideas/` に閉じ込める。
- 実験モジュールは作成した geometry、material、animation、event listener を cleanup で戻す。
- 公開したくない仕様や作業メモを `public/` に置かない。

## 検証

- コード変更後は最低限 `npm run typecheck` を実行する。
- ビルドや配信設定を触った場合は `npm run build` も実行する。
