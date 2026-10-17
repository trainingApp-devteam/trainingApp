# AGENTS.md

このリポジトリを編集するAIコーディングツール（Claude Code、Codex、Cursor、GitHub Copilot など）と開発者が守るルール。
ここに書いたルールは全開発者共通。個人の好みはここに書かず、各自のツールの個人設定に置く。

## プロジェクト概要

筋トレの記録と体重・体脂肪率の推移を確認するWebアプリ（TrainingApp）。

| ディレクトリ | 内容 |
| --- | --- |
| `frontend/` | Vite + React 18 + TypeScript + Tailwind。単体テストは Vitest + Testing Library、E2Eは Playwright（`frontend/e2e/`） |
| `backend/` | Spring Boot（Java 17）+ Spring JDBC + Flyway。開発プロファイルはH2インメモリ、本番・Docker構成はMySQL 8.4 |
| `docs/` | 設計書（`overview-design.md`、`detailed-design/`）、API契約（`openapi.yaml`）、WBS（`wbs/project-wbs.md`）、運用手順（`operations/`） |
| `docker/`、`docker-compose*.yml`、`infra/` | コンテナ・配信（Caddy）・バックアップ |

画面の文言、コードコメント、設計書、コミットメッセージは日本語で書く。

## コミットメッセージ（必須）

1行目は必ず次の形式にする。

```
yyyy-mm-dd 修正内容の概要
```

- `yyyy-mm-dd` はコミットした日付。日付の後ろは半角スペース1つ（`-` などの区切り記号は入れない）。
- 概要は日本語で、何を変えたかが分かるように書く。
- 詳細は1行空けて本文に箇条書きで書いてよい。

例:

```
2026-10-17 記録画面でYouTubeプレイリストを再生する音楽プレーヤーを追加

- 前の曲・一時停止・次の曲・シャッフル
- 再生できない動画を自動で飛ばす
```

古い履歴には `2026-10-15 - 概要` の形式もあるが、今後は上の形式だけを使う。

## ブランチとプッシュ

- `main` へ直接コミット・プッシュしない。作業ブランチで作業し、`main` へはプルリクエストで取り込む。
- コミット・プッシュは、依頼された場合にだけ行う。

## 変更時に必ず一緒に更新するもの

`docs/detailed-design/README.md` の変更ルールに従う。特に次を守る。

- 仕様・画面・APIを変えたら、同じ変更で関係する設計書（業務機能・画面・API・データ・テスト設計書）と WBS（`docs/wbs/project-wbs.md`）を更新する。WBSには作業行（状態・完了日・備考）を追加または更新する。
- APIのパスやメソッドを増減したら `docs/openapi.yaml` も更新する。Backendのテスト（`generatedApiDocsMatchTheOpenApiContract`）が実装との差分を検出して失敗する。
- DBを変えるときは Flyway の新しい番号のマイグレーション（`backend/src/main/resources/db/migration/V{n}__説明.sql`）を追加する。既存のマイグレーションは書き換えない。H2（MySQL互換モード）とMySQL 8.4の両方で動くSQLにする。データを削除するマイグレーションは、適用前にバックアップが必要な旨を設計書に書く。
- 動作を変えたら、対応するテストを追加・更新する。

## 確認コマンド

コミット前に、変更した範囲のテストを実行して成功を確認する。

```powershell
# Backend（統合テスト含む）
Push-Location backend; .\gradlew.bat test; Pop-Location

# Frontend（型検査・単体テスト・ビルド）
Push-Location frontend; npx tsc --noEmit; npx vitest run; npm run build; Pop-Location

# E2E（実Backend+Frontendを自動起動）。開発サーバーと重ならないよう別ポートで実行できる
Push-Location frontend
$env:E2E_BACKEND_PORT = "18090"; $env:E2E_FRONTEND_PORT = "15190"
npm run e2e
Pop-Location
```

Windows で E2E の起動時に「`gradlew.bat` は内部コマンドまたは外部コマンド…として認識されていません」と出る場合は、環境変数 `NoDefaultCurrentDirectoryInExePath` が設定されている。そのシェルでは外してから実行する（bash: `env -u NoDefaultCurrentDirectoryInExePath npm run e2e`）。

ローカル起動方法は `README.md` を参照。

## 実装上の約束

- 利用者のデータは常に認証済みセッションの本人に限定する。リクエストの userId は信用しない。他人のIDを指定した取得・更新・削除は `404`。
- 状態を変える API は CSRF トークンが必要（フロントの `src/api/client.ts` が処理する）。
- 画面の色は `frontend/src/styles/ui.ts` の共通クラスを使い、濃色背景で文字のコントラスト（WCAG AA）を保つ。E2Eの `contrast.spec.ts` が検査する。
- グラフは `frontend/src/components/LineChart.tsx` を使う。単位の違う値を1つのグラフに重ねない（二軸にしない）。
- 種目は標準種目（Flywayで登録）だけ。利用者が種目を作成する機能は廃止済みなので復活させない。
- 消費カロリーはサーバーが係数から計算する。クライアントから kcal や MET を送らない。
