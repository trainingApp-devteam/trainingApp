# プロジェクト WBS

目的: フロントエンド、バックエンド・インフラ・QA・ドキュメント・リリースまでの全タスクを網羅的に分解する。

前提: バックエンドは REST API で実装され、フロントは Vite + React + TypeScript + Tailwind を使用。

1. 準備作業 (表形式)

|   ID | 作業                                                      | 状態 | 完了日    | 備考                                           |
| ---: | --------------------------------------------------------- | ---- | --------- | ---------------------------------------------- |
|  1.1 | フロントエンド初期構成確認（Vite/React/Tailwind）         | 〇    | 2026/9/26 | Vite/React/Tailwind設定あり                    |
|  1.2 | TypeScript 化確認（tsconfig/.tsx）                        | 〇    | 2026/9/26 | tsconfig.jsonと.tsxファイルあり                |
|  1.3 | ルーティング導入と画面スケルトン確認                      | 〇    | 2026/9/26 | BrowserRouter/Routesと各画面あり               |
|  1.4 | Tailwind/PostCSS 設定確認                                 | 〇    | 2026/9/26 | `tailwind.config.cjs`/`postcss.config.cjs` あり |
|  1.5 | リポジトリ整理・ブランチ作成                              | 〇    | 2026/9/27 | ブランチ作成・整理済み（現在のブランチは`main`） |
|  1.6 | 開発環境確認・依存インストール                            | 〇    | 2026/9/27         | 依存導入・lint設定確認（lint script未設定）     |
|  1.7 | CI パイプライン雛形作成（lint/build/test）                | 〇    | 2026/9/27 | GitHub Actions ワークフロー追加（.github/workflows/ci.yml） |
|  1.8 | 共通 UI コンポーネント作成（Button/Card/Modal/FormField） | 〇    | 2026/9/27 | 基本コンポーネント雛形を `frontend/src/components` に追加 |
| 1.9 | API モック/契約定義（OpenAPI or msw）                     | 〇    | 2026/9/27 | `docs/openapi.yaml` と MSW モックを追加（frontend/src/mocks） |

2. フロントエンド実装（優先1〜3）

|   ID | 作業                                     | 状態 | 完了日    | 備考                             |
| --: | ---------------------------------------- | ---- | --------- | -------------------------------- |
|  2.1 | Home: レイアウト・静的マークアップ       | 〇    | 2026/9/26 | ヘッダー/メイン/サイドを実装済み |
| 2.2 | Home: 日付表示・ユーザーメニュー | 〇 | 2026/10/15 | ヘッダーに日付をローカル日付で表示（UTC日付だと日本時間0〜9時に前日になる不具合を修正）。Homeの日付表示とアカウントドロップダウンは、ヘッダーのハンバーガーメニューへ統合 |
| 2.3 | Home: クイックアクション（ルーティング） | 〇 | 2026/10/15 | Homeの主要操作（今すぐ記録／メニューを作成）のみ残し、クイックリンクはヘッダーのハンバーガーメニューへ統合 |
|  2.4 | Home: 直近記録（空/読み込み/エラー）     | 〇    | 2026/9/26 | 空状態メッセージを表示中         |
|  2.5 | Home: 身体測定スニペット                 | 〇    | 2026/9/26 | 身体測定のプレースホルダ表示あり |
|  2.6 | Home: レスポンシブ調整                   | 〇    | 2026/9/26 | Tailwind グリッドで対応済み      |
|  2.7 | Home: テスト/確認                        | 〇    | 2026/9/27 | 単体テスト（Vitest/Testing Library）実施済み |
| 2.8 | Home: 表示文言更新（「メニューから開始」→「メニューを作成」） | 〇 | 2026/9/29 | Home のリンク文言と遷移先を `/record/select` に変更 |
| 2.9 | Record: UX 設計                          | 〇    | 2026/9/27 | `frontend/src/pages/Record.tsx` にメニュー作成・実行フロー、タイマー、ラベル等を実装 |
| 2.10 | Record: 種目検索コンポーネント           | ×    | -         | モーダル式の種目検索は撤回。部位（グループ）→種目セレクトへ統合（frontend/src/pages/Record.tsx） |
| 2.11 | Record: セット入力 UI                    | 〇    | 2026/9/27 | 行の追加/削除/並べ替え/編集を `frontend/src/pages/Record.tsx` で実装。セット遷移時のタイマーリセットを修正 |
| 2.12 | Record: 入力バリデーション               | 〇    | 2026/9/27 | 回数/時間/負荷の基本バリデーションを追加（追加ボタン無効化、開始前の全セット検証を実装）            |
| 2.13 | Record: 保存処理 + API 結合              | 〇    | 2026/10/04 | `/api/v1/training-sessions`へ接続し、画面DTOと複数種目のセッション契約を変換 |
| 2.14 | Record: アクセシビリティ/UX              | 〇    | 2026/9/27 | キーボード操作（Enterで追加）、aria-live/role=alert、フォーカスリングを実装 |
| 2.15 | Record: テスト                           | 〇    | 2026/9/27 | Record ページの単体テストを追加（frontend/src/pages/__tests__/Record.test.tsx） |
| 2.16 | Exercise Select: 検索 UX                 | 〇    | 2026/9/27 | モーダルは採用せず、部位→種目セレクト方式に変更し Record に統合 |
| 2.17 | Exercise Select: 検索 API モック         | 〇    | 2026/9/27 | `frontend/src/mocks/handlers.ts` に `/api/exercises` モックを追加                     |
| 2.18 | Exercise Select: 複数選択（撤回）        | -    | -         | 複数選択機能は採用を撤回。Record は部位→種目のセレクト方式に統合                     |
| 2.19 | Exercise Select: 独自種目作成モーダル    | 〇    | 2026/9/27 | 独自種目作成モーダルを実装（frontend/src/components/CreateExerciseModal.tsx） |
| 2.20 | Exercise Select: テスト                  | 〇    | 2026/9/27 | CreateExerciseModal の単体テストを追加（frontend/src/components/__tests__/CreateExerciseModal.test.tsx） |
| 2.21 | 新ルート: 選択画面 `/record/select` の追加 | 〇 | 2026/9/28 | `frontend/src/pages/SelectRecordMode.tsx` を追加：新規作成 or 保存メニュー選択を選べる画面 |
| 2.22 | SelectMenu: 保存済メニュー選択ページ     | 〇 | 2026/10/04 | `/api/v1/routines`から選択し、`/record?menuId=<id>&autoStart=1`へ遷移 |
| 2.23 | Record: 保存済メニューからの自動開始対応 | 〇 | 2026/9/28 | `Record.tsx` が `menuId`/`autoStart` を受け取り、plan をセット後に自動開始する `autoStartPending` パターンを実装 |
| 2.24 | Record: 独自種目作成ボタン一時非表示     | 〇 | 2026/9/28 | UI から独自作成ボタンを隠す（機能自体は残すがフローから除外） |
| 2.25 | Account: セッション認証と招待登録 | 〇 | 2026/10/15 | Cookieセッションへ接続し、平文パスワード/localStorage認証を除去。ログイン/ログアウト操作と表示名はヘッダーに集約（Account画面のログアウトボタンは廃止） |
| 2.26 | Body: 身体測定登録機能実装              | 〇 | 2026/10/04 | 身長/体重/体脂肪を測定APIへ接続し、日付単位に集約表示 |
| 2.27 | localStorage: 認証/測定/メニュー依存の除去 | 〇 | 2026/10/04 | 認証・身体測定・ルーティンの読み書きをAPIへ移行 |
| 2.28 | 自動開始の動作確認（手動検証） | 〇 | 2026/10/13 | E2Eで検証。保存メニュー選択時にRPE・推定対象フラグが未設定で自動開始できない不具合を発見し修正（Record.tsx） |

3. フロントエンド拡張（優先4〜等）

|  ID | 作業                                       | 状態 | 完了日 | 備考                     |
| --: | ------------------------------------------ | ---- | ------ | ------------------------ |
| 3.1 | 履歴一覧: リスト表示・フィルタ・ページング | 〇    | 2026/10/04      | 日付降順・ページング（ページ切替）を実装 |
| 3.2 | 履歴詳細: 記録詳細表示・編集・削除 | 〇 | 2026/10/13 | 記録詳細の表示に加え、日付・メモ・セットの編集（回数/時間/重量、コピー、削除）を実装。回数/時間を変えたセットの推定カロリーは未計算に戻す（`PUT /training-sessions/{id}`） |
| 3.3 | メニュー管理: 一覧・作成・編集・削除       | 〇    | 2026/10/04      | ルーティンAPIへ接続し、目標回数/時間/負荷も保存 |
| 3.4 | 共通ヘッダー: ハンバーガーメニューへのナビ統合 | 〇 | 2026/10/15 | ヘッダーのリンクとHomeのクイックリンク・アカウントドロップダウンの重複を解消。記録/履歴/メニュー/身体測定/アカウントを1つのメニューに集約（現在ページ強調、Escape・外側クリック・ページ移動で閉じる、モバイル幅対応）。単体テスト5件+E2E |
| 3.5 | ヘッダー: ログイン/ログアウトとアカウント名表示 | 〇 | 2026/10/15 | 未ログインは「ログイン」リンク、ログイン中は表示名（なければユーザー名）と「ログアウト」ボタンを表示。ログイン/ログアウト時に即時反映（`api/authEvents.ts`）、ログアウト失敗時は状態を維持。単体テスト6件+E2E（ログイン→表示→ログアウト→再読込）|

4. バックエンド実装

|  ID | 作業                                  | 状態 | 完了日 | 備考                         |
| --: | ------------------------------------- | ---- | ------ | ---------------------------- |
| 4.1 | API 設計（OpenAPI）とデータモデル確定 | 〇    | 2026/10/04 | `/api/v1`契約とFlyway初期スキーマを確定（docs/openapi.yaml） |
| 4.2 | 認証・認可実装（JWT or セッション）   | 〇    | 2026/10/04 | セッション/CSRF、招待申請、Admin承認/却下/失効、ログイン/ログアウト/Refreshを実装 |
| 4.3 | Record CRUD 実装                      | 〇    | 2026/10/04 | training-sessionsの作成/一覧/詳細/全体更新/削除、所有者分離を実装 |
| 4.4 | Exercise 検索・管理エンドポイント     | 〇    | 2026/10/04 | 共通/本人種目の検索、独自種目CRUDを実装 |
| 4.5 | BodyMeasure CRUD 実装                 | 〇    | 2026/10/04 | 項目別範囲検証を含む測定一覧/作成/更新/削除を実装 |
| 4.6 | Menu 管理エンドポイント               | 〇    | 2026/10/04 | routinesの一覧/作成/詳細/更新/削除を実装 |

5. データベース & 永続化

|  ID | 作業                                   | 状態 | 完了日 | 備考             |
| --: | -------------------------------------- | ------ | ------ | ---------------- |
| 5.1 | DB スキーマ設計（ER 図） | 〇 | 2026/10/13 | ER図を `docs/detailed-design/data-design.md` に整備し、カロリー推定テーブル（V4〜V6）を反映 |
| 5.2 | マイグレーション作成（初期データ含む） | 〇 | 2026/10/13 | Flyway V1〜V7（初期スキーマ、ルーティン目標、開発用種目、カロリー係数、セット推定参照、体重、追加インデックス）を作成。MySQL 8.0.43（ローカルmysqld）で全版の適用・起動・E2E成功を確認 |
| 5.3 | パフォーマンス考慮（インデックス） | 〇 | 2026/10/13 | 主要クエリ向けインデックスを V1・V7 で整備（種目別履歴、係数検索、推定履歴）。MySQL 8.0でEXPLAINによりインデックス使用を確認 |
| 5.4 | バックアップ・復元手順文書化 | 〇 | 2026/10/13 | `docs/operations/backup-restore.md` と `infra/backup/{backup,restore}.sh`（mysqldump+age暗号化+別保存先）。MySQL 8.0でmysqldump→別DBへ復元し件数・Flyway版一致を確認。age/rclone/Docker経由の実運用テストは公開前に実施 |
| 5.5 | DB 接続と ORM 設定 | 〇 | 2026/10/13 | JDBC接続（Spring JDBC）とHikariCP設定（上限/最小アイドル/タイムアウト、環境変数で調整）、graceful shutdown を `application.yml` に設定 |

6. インフラ & CI/CD

|  ID | 作業                                           | 状態 | 完了日 | 備考                   |
| --: | ---------------------------------------------- | ---- | ------ | ----------------------- |
| 6.1 | コンテナ化（Dockerfile multi-stage） | 〇 | 2026/10/13 | backend(Gradle/JDK17・非root)、frontend、本番用(Caddy)のDockerfileとcompose。開発用composeと本番用composeをDocker実機で起動し、画面表示・SPAフォールバック・API・actuator非公開・セキュリティヘッダーを確認 |
| 6.2 | レジストリ & デプロイ手順整備 | 〇 | 2026/10/13 | GHCR運用とサーバー手順を `docs/operations/deployment.md` に整備。タグpushで `release.yml` がイメージを公開 |
| 6.3 | Infra テンプレート作成（Bicep/Terraform） | 〇 | 2026/10/13 | 設計書の構成（単一VPS+Compose+Caddy）に合わせ、Bicep/Terraformの代わりに `docker-compose.prod.yml`・`docker/caddy/Caddyfile`・`.env.prod.example` を作成。マネージドクラウド採用時にIaCを追加 |
| 6.4 | GitHub Actions: build/test/deploy ワークフロー | 〇 | 2026/10/13 | ci.yml（frontend/backend/e2e）と release.yml（GHCR公開・Release作成・任意のSSHデプロイ）。デプロイジョブは `DEPLOY_ENABLED` とSecrets設定時のみ有効 |
| 6.5 | Secrets/Key 管理手順作成 | 〇 | 2026/10/13 | `docs/operations/secrets.md`（一覧、保管場所、更新契機、漏えい時対応） |
| 6.6 | モニタリング設定 | 〇 | 2026/10/13 | Actuatorのliveness/readiness、X-Request-Idとログ連携、未処理例外のログ出力、コンテナhealthcheck、`docs/operations/monitoring.md`。APM導入は将来対応 |

7. テスト & 品質保証

|  ID | 作業                                     | 状態 | 完了日 | 備考               |
| --: | ---------------------------------------- | ---- | ------ | ------------------ |
| 7.1 | 単体テスト作成（フロント/バック） | 〇 | 2026/10/13 | Frontend 25件（apiクライアント、記録API変換、履歴/履歴詳細/Account/Record/Home/モーダル）、Backend 統合12件+単体8件（ApiValues、RequestIdFilter）。CIで自動実行 |
| 7.2 | 統合テスト（API 結合）                   | 〇    | 2026/10/04 | Spring API結合テストで認証/CSRF、CRUD、所有権、ルーティン目標値を検証 |
| 7.3 | E2E テスト（Playwright/Cypress）スモーク | 〇 | 2026/10/13 | Playwrightスモーク（`frontend/e2e/smoke.spec.ts`）。ログイン→体重登録→保存メニューの自動開始→記録→推定kcal表示→編集を実Backend+Frontendで検証。CIのe2eジョブでも実行 |

8. ドキュメント・運用準備

|  ID | 作業                               | 状態 | 完了日 | 備考             |
| --: | ---------------------------------- | ---- | ------ | ---------------- |
| 8.1 | README・セットアップ手順更新       | 〇    | 2026/10/04 | H2開発環境、Admin初期化、Viteプロキシ、MSW切替、データ揮発性を追記 |
| 8.2 | 運用 runbook（ログ確認・障害対応） | 〇 | 2026/10/13 | `docs/operations/runbook.md`（コマンド、症状別対応、点検、障害記録） |
| 8.3 | API ドキュメント生成（OpenAPI） | 〇 | 2026/10/13 | springdocで `/v3/api-docs` を生成（dev）。Backendテストで `docs/openapi.yaml` との差分を検出し、CIで生成物をartifact化 |
| 8.4 | リリースノートテンプレート作成 | 〇 | 2026/10/13 | `docs/operations/release-notes-template.md`。タグpush時にGitHub Releaseを自動生成 |

9. リリース作業

|  ID | 作業                     | 状態 | 完了日 | 備考             |
| --: | ------------------------ | ---- | ------ | ---------------- |
| 9.1 | リリースビルド作成・検証 | 〇 | 2026/10/13 | bootJar生成と起動(readiness 200)、`npm run build`、CI全ジョブ成功を確認。手順は `docs/operations/release-checklist.md` |
| 9.2 | デプロイ実行・検証 | △ | - | 手順書（`docs/operations/deployment.md`）と `release.yml` のSSHデプロイを整備し、本番相当の `docker-compose.prod.yml` はローカルで起動確認済み。実サーバー（VPS/ドメイン/GHCR公開）が未契約のため実デプロイは条件付きで未実施 |
| 9.3 | ロールアウト監視 | △ | - | 監視手順（`docs/operations/monitoring.md`）・Runbook・外形監視項目を整備。公開環境が無いためロールアウト監視の実施は条件付きで未実施 |

10. フロントエンド・バックエンド結合

| ID | 作業 | 状態 | 完了日 | 備考 |
| --: | --- | --- | --- | --- |
| 10.1 | Vite `/api` プロキシとMSW切替 | 〇 | 2026/10/04 | 実API接続を既定にし、MSWは`VITE_USE_MSW=true`で選択 |
| 10.2 | 共通APIクライアント（Cookieセッション/CSRF/エラー） | 〇 | 2026/10/04 | `/api/v1`、同一オリジンCookie、CSRFヘッダーを実装 |
| 10.3 | 種目・記録・履歴・Homeを実API接続 | 〇 | 2026/10/04 | 画面DTOとページング付きセッション契約を変換。開発用種目カタログを追加 |
| 10.4 | アカウント・身体測定・ルーティンを実API接続 | 〇 | 2026/10/04 | 招待登録/ログイン、測定値 CRUD、ルーティンCRUDとセット目標値を実装 |
| 10.5 | フロント/バック結合確認と開発手順 | 〇 | 2026/10/04 | Backendテスト、Frontendテスト/ビルドを実行。ブラウザE2Eは7.3で実施 |

11. 消費カロリー推定

| ID | 作業 | 状態 | 完了日 | 備考 |
| --: | --- | --- | --- | --- |
| 11.1 | 設計書へのカロリー推定仕様の反映 | 〇 | 2026/10/13 | MET式、RPE帯、係数seed、API、画面、テスト観点を詳細設計へ追記 |
| 11.2 | 競合解消と実Backendへの統合 | 〇 | 2026/10/13 | 別系統だったカロリーAPI/Maven/重複Flywayを `dev.training` + Gradle へ統合し、競合マーカーを除去 |
| 11.3 | 推定API・係数マスタ | 〇 | 2026/10/13 | `POST /calorie-estimates`、`GET /exercises/{id}/calorie-rates`、V4で標準種目コードと係数を登録。標準種目以外は422 |
| 11.4 | 推定結果の記録保存 | 〇 | 2026/10/13 | V5で `set_records.calorie_estimate_id` を追加。本人・同一種目の推定のみ紐付け可 |
| 11.5 | 体重のアカウント保存 | 〇 | 2026/10/13 | V6で `users.body_weight_kg`、`PUT /auth/me/profile`。ブラウザにはキャッシュとして保持 |
| 11.6 | 画面表示（Record/履歴/履歴詳細） | 〇 | 2026/10/13 | セット別・合計の推定kcalを表示。未計算は空欄/対象外 |
| 11.7 | CIにバックエンドテスト追加・型チェック修正 | 〇 | 2026/10/13 | ci.ymlにbackendジョブ、`vite-env.d.ts`追加。`main`・`ichikawa_work` へのpushと `main` 宛PRで起動 |
| 11.8 | MySQL/Docker環境での結合確認 | 〇 | 2026/10/13 | `docker compose up --build`（MySQL 8.4）でV1〜V7適用、Backend起動、再起動後もhealthy、E2E成功を確認。MySQLのhealthcheck不具合（healthcheck.sh非存在）を修正し、3306使用中でも `DB_HOST_PORT` で変更可能に |
| 11.9 | カロリー計算の境界値テスト | 〇 | 2026/10/13 | RPE帯の境界（1/4/5/7/8/10）、REP/MINUTEの不一致、体重20/300kgの境界、丸め（3.675→3.68）、係数なし・独自種目・存在しない種目の422を検証 |
| 11.10 | CIのフロントジョブ修正（Node設定） | 〇 | 2026/10/13 | 初回実行で Setup Node.js が失敗。`.nvmrc` 参照・lockファイルのパス指定・`npm ci` へ変更し、再実行でフロント/バックエンドとも成功を確認 |
| 11.11 | 日付のローカル化・E2Eの別ポート実行 | 〇 | 2026/10/15 | 記録/身体測定の初期日付もローカル日付に統一（`utils/date.ts`）。Playwrightは `E2E_BACKEND_PORT`/`E2E_FRONTEND_PORT` で開発サーバーと独立して実行可能 |
