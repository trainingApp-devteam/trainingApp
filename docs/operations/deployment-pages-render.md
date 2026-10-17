# デプロイ手順（GitHub Pages + Render + Aiven for MySQL）

Dockerサーバーを持たずに、無料枠で公開する構成。サーバー構成（[deployment.md](deployment.md)）の代わりに使える。

| 要素 | サービス | 定義 |
| --- | --- | --- |
| 画面 | GitHub Pages（`https://<owner>.github.io/<repo>/`） | [.github/workflows/pages.yml](../../.github/workflows/pages.yml) |
| API | Render（Web Service、Docker、Free） | [render.yaml](../../render.yaml)、`backend/Dockerfile` |
| DB | Aiven for MySQL（Free プラン、MySQL 8） | 接続情報をRenderの環境変数に設定 |

画面とAPIが別ドメインになるため、APIは `SameSite=None; Secure` のCookieとCORSで動かし、CSRFトークンは `GET /auth/csrf` のレスポンスヘッダー `X-XSRF-TOKEN` で画面に渡す（同一ドメイン構成ではこれまでどおりCookieから読む）。

## 無料枠の制約（2026-10-18 時点の公開情報。採用前に公式で再確認する）

- Render Free: 15分アクセスがないと停止し、次のアクセスで起動に約1分かかる。月750時間まで。メモリは512MB程度。
- Aiven Free: 1 CPU・1GB RAM・1GBストレージ、単一ノード（冗長化なし）。使われていないと停止され、通知後に手動で再開する。
- GitHub Pages: 非公開リポジトリで使うには有料プラン（Pro/Team以上）が必要。
- Safari など一部のブラウザーは、別ドメインのCookieを制限する設定のときにログインを保てないことがある。問題になる場合は独自ドメインで画面とAPIを同じサイト（例: `app.example.com` と `api.example.com`）にそろえる。

## 1. DB（Aiven）

1. Aiven に登録し、MySQL の Free プランでサービスを作成する。
2. 接続情報（Host、Port、User=`avnadmin`、Password、Database=`defaultdb`）を控える。
3. JDBC URL: `jdbc:mysql://<Host>:<Port>/defaultdb?sslMode=REQUIRED&serverTimezone=UTC`

## 2. API（Render）

1. Render に GitHub でログインし、New > Blueprint でこのリポジトリを選ぶ（`render.yaml` が読み込まれる）。
2. 入力を求められる環境変数を設定する。
   - `DB_URL` / `DB_USERNAME` / `DB_PASSWORD`: 手順1の値
   - `TRAININGAPP_CORS_ALLOWED_ORIGINS`: `https://<owner>.github.io`（パスは付けない）
   - `TRAININGAPP_ADMIN_USERNAME` / `TRAININGAPP_ADMIN_PASSWORD`: 初期管理者（12文字以上）
3. デプロイ完了後、`https://<service>.onrender.com/actuator/health` が `{"status":"UP"}` を返すことを確認する。起動時にFlywayがDBへマイグレーションを適用する。
4. 管理者でログインできたら、Renderの画面で `TRAININGAPP_ADMIN_USERNAME` / `TRAININGAPP_ADMIN_PASSWORD` を削除する。

## 3. 画面（GitHub Pages）

1. リポジトリの Settings > Pages で Source を「GitHub Actions」にする。
2. Settings > Secrets and variables > Actions > Variables に `API_BASE_URL` = `https://<service>.onrender.com` を登録する。
3. `main` へマージする（または Actions の「Deploy frontend to GitHub Pages」を手動実行する）。
4. `https://<owner>.github.io/<repo>/` を開き、ログイン・記録の保存ができることを確認する。

## 4. 更新

- `main` へマージすると、Render（`autoDeploy`）と GitHub Pages（`frontend/**` の変更時）が自動で更新される。
- DBマイグレーションは元に戻せない。DBを変えるリリースの前に、Aiven のバックアップ（Freeプランの有無を確認）または `mysqldump` で退避する。
