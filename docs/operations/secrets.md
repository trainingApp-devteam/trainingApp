# Secrets / 鍵管理手順

## 1. 方針

- パスワード・トークン・鍵をGit、イメージ、ビルド成果物、ログへ含めない。
- 本番・検証サーバーの値は、ローカル開発・CI・docker-compose（開発用）と必ず別の値にする。
- 設定ファイルにはキー名とダミー値だけを置く（[.env.prod.example](../../.env.prod.example)）。実値は`.env.prod`（Git管理外、`chmod 600`）へ置く。

## 2. Secretsの一覧と保管場所

| 名前 | 用途 | 保管場所 | 更新契機 |
| --- | --- | --- | --- |
| `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | DB接続・管理 | サーバーの`.env.prod` | 年1回、担当者の変更時、漏えい疑い時 |
| `TRAININGAPP_ADMIN_USERNAME/PASSWORD` | 初期Admin作成 | `.env.prod`（作成後に削除） | 初回のみ。ログイン後にパスワードを変更 |
| `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` | SSHデプロイ | GitHub Environment `production` のSecrets | 鍵ローテーション時 |
| `GITHUB_TOKEN` | GHCRへのpush・Release作成 | Actionsが自動発行 | 自動 |
| GHCR読み取りPAT | サーバーの`docker pull` | サーバーの`~/.docker/config.json` | 有効期限ごと |
| `AGE_RECIPIENT`（公開鍵） | バックアップ暗号化 | サーバーの環境（公開情報） | 鍵更新時 |
| age秘密鍵 | バックアップ復号 | 運用担当のオフライン保管（サーバーに置かない） | 鍵更新時 |
| R2等の保存先資格情報 | バックアップ転送 | `rclone.conf`（`chmod 600`） | 年1回、漏えい疑い時 |

## 3. 運用ルール

1. 値はパスワードマネージャーで生成・共有し、チャットやIssueに貼らない。
2. GitHubのSecretsは`production`環境に限定し、必要なら承認者を設定する。
3. SSH鍵はデプロイ専用に作り、サーバー側で`docker compose`以外の権限を与えない。
4. 漏えいが疑われる場合: 該当値を即時無効化・再発行 → サーバーの`.env.prod`更新 → `docker compose up -d`で反映 → 影響範囲（監査ログ、アクセスログ）を確認 → 記録を残す。
5. ログへ出さない値: パスワード、Cookie、招待トークン、身体測定値（[インフラ・運用設計書](../detailed-design/infrastructure-design.md) 7章）。
6. 公開リポジトリ化・外部共有の前に、履歴に鍵や`.env`が含まれていないことを確認する（例: `git log -p -S'PASSWORD'`）。

## 4. クラウドのシークレットストアを使う場合（将来）

Azure Key VaultやAWS Secrets Managerへ移行する場合は、アプリ側は環境変数（`DB_URL`、`DB_USERNAME`、`DB_PASSWORD`）の受け取りのまま変更せず、コンテナ実行基盤の機能で注入する。
