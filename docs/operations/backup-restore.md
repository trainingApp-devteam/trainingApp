# バックアップ・復元手順

対象: 本番/検証サーバーのMySQL（`docker-compose.prod.yml`の`db`）。スクリプトは [infra/backup/](../../infra/backup/)。実サーバーでの実行確認は未実施のため、初回運用前に下記「復元テスト」を必ず行う。

## 1. 方針

| 項目 | 内容 |
| --- | --- |
| 頻度 / 保持 | 日次 / 直近30日（利用実績を見て公開前に再確認） |
| 方式 | `mysqldump --single-transaction`（論理バックアップ）→ gzip → age暗号化 |
| 保存先 | サーバー内`/var/backups/trainingapp`（短期）と別環境のオブジェクトストレージ（例: Cloudflare R2）。本番DBと異なる保存先に置く |
| 暗号化鍵 | age公開鍵でサーバー側が暗号化。秘密鍵はオフライン保管（[Secrets管理](secrets.md)） |
| 目標 | RPO: 24時間以内、RTO: 2時間以内（目標値。復元テスト結果で見直す） |

## 2. 事前準備（サーバー）

1. `age`、`rclone`を導入する。`age-keygen -o key.txt`で鍵を作り、**公開鍵だけ**をサーバーへ設定、秘密鍵は運用担当が別保管する。
2. `rclone config`で保存先リモート（例: `r2`）を設定し、`chmod 600 ~/.config/rclone/rclone.conf`。
3. `/opt/trainingapp`で動作確認:

```bash
AGE_RECIPIENT=age1xxxxxxxx RCLONE_REMOTE=r2:trainingapp-backup infra/backup/backup.sh
```

4. systemd timerまたはcronで日次実行する（例: 毎日03:30）。失敗時に気づけるよう、終了コードを監視する（[監視設定](monitoring.md)）。

## 3. 復元手順

1. 事故の原因調査より先に、現状のDBのバックアップを取得する（上書きしても戻せるように）。
2. バックアップを取得する: `rclone copy r2:trainingapp-backup/trainingapp-<日時>.sql.gz.age .`
3. アプリを止める: `docker compose --env-file .env.prod -f docker-compose.prod.yml stop backend caddy`
4. 復元する:

```bash
AGE_IDENTITY=/secure/key.txt infra/backup/restore.sh trainingapp-<日時>.sql.gz.age
```

5. 起動して確認する: `docker compose ... up -d`、ログイン、直近の記録・メニュー・身体測定が表示されること。
6. 実施内容と所要時間を記録する。

## 4. 復元テスト（四半期ごと・初回運用前）

別ディレクトリで検証用composeを起動し、最新バックアップを復元して下記を確認する。結果（日付、バックアップ名、所要時間、確認者）をRunbookの記録欄に残す。

- `flyway_schema_history`の最新バージョンが本番と一致する。
- `users`、`training_sessions`、`set_records`、`exercise_calorie_estimates`の件数が妥当。
- Adminでログインでき、履歴詳細にセットと推定kcalが表示される。

## 5. 注意

- DBを直接手修正しない。必ずバックアップ取得 → 原因調査 → 復旧の順に進める。
- バックアップには個人の身体測定値が含まれる。暗号化なしで持ち出さない。
- `docker compose down -v`はDBボリュームを削除する。本番では実行しない。
