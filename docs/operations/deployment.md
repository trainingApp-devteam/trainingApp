# デプロイ手順（レジストリ・サーバー構成）

[インフラ・運用設計書](../detailed-design/infrastructure-design.md) の推奨構成（単一VPS + Docker Compose + Caddy）に沿った手順。サーバーは未契約のため、実環境での実行確認は未実施。

## 1. 構成

| 要素 | 内容 |
| --- | --- |
| イメージ保管 | GitHub Container Registry（GHCR）。`ghcr.io/<owner>/trainingapp-backend` / `trainingapp-frontend` |
| フロント配信 | `frontend/Dockerfile.prod`。Reactをビルドし、Caddyが静的配信・HTTPS終端・`/api`のリバースプロキシを行う |
| API | `backend/Dockerfile`（非rootユーザー、JRE 17） |
| DB | MySQL 8.4（named volume、ホストへ非公開） |
| 定義 | [docker-compose.prod.yml](../../docker-compose.prod.yml)、[.env.prod.example](../../.env.prod.example) |

## 2. イメージの作成とレジストリ登録

1. `main` へマージ後、`v0.1.0` のようなタグを付けて push する（またはActionsの「Release」を手動実行しバージョンを入力する）。
2. [release.yml](../../.github/workflows/release.yml) がbackend/frontendのイメージをGHCRへ push し、タグ起点ならGitHub Releaseを自動生成する。
3. GHCRのパッケージはprivateのまま使う。サーバーでは`docker login ghcr.io`（`read:packages`のみ付与したPAT）を事前に実行する。

## 3. 初回セットアップ（サーバー）

1. Docker Engine と Compose プラグインを導入し、`80/tcp`・`443/tcp`・SSHのみ許可する（DB/APIポートは公開しない）。
2. DNSのAレコードを`SITE_ADDRESS`のホスト名へ向ける。
3. `/opt/trainingapp` に `docker-compose.prod.yml` と `.env.prod`（`.env.prod.example`をコピー）を配置し、`chmod 600 .env.prod`。値の扱いは[Secrets管理手順](secrets.md)を参照。
4. `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d`。
5. 初回のみ`TRAININGAPP_ADMIN_USERNAME/PASSWORD`でAdminが作成される。作成を確認したら`.env.prod`から両方を削除して`up -d`で反映する。
6. 確認: `curl -fsS https://<SITE_ADDRESS>/` が表示され、`curl -s -o /dev/null -w '%{http_code}' https://<SITE_ADDRESS>/actuator/health` が`404`（外部非公開）であること、Admin でログインできること。

## 4. 更新（通常のデプロイ）

手動の場合:

```bash
cd /opt/trainingapp
sed -i 's/^APP_VERSION=.*/APP_VERSION=v0.1.1/' .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

自動の場合: リポジトリ変数`DEPLOY_ENABLED=true`、`DEPLOY_PATH`、環境`production`のSecrets（`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`）を設定すると、Releaseワークフローの`deploy`ジョブが同じ手順をSSHで実行する。

- DBマイグレーションはbackend起動時にFlywayが適用する。**更新前に[バックアップ](backup-restore.md)を取得する。**
- Flywayは前進のみ。破壊的変更を含むリリースでは、ロールバック用にバックアップからの復元手順を使う。

## 5. ロールバック

1. 直前の正常バージョンに`APP_VERSION`を戻し、`pull` → `up -d`。
2. マイグレーションが適用済みでスキーマ互換が崩れる場合は、更新前バックアップを[復元](backup-restore.md)してから旧バージョンを起動する。
3. 切り戻し後、[Runbook](runbook.md)の確認項目で動作を確認し、原因を記録する。
