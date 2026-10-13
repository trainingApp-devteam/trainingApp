#!/usr/bin/env bash
# MySQLの論理バックアップを取得し、age で暗号化して別保存先(例: Cloudflare R2)へ転送する。
# 前提: docker compose(本番) が稼働中、age と rclone が導入済み、.env.prod を読み込める。
# 使い方: infra/backup/backup.sh   (cron/systemd timerで日次実行)
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/trainingapp}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
AGE_RECIPIENT="${AGE_RECIPIENT:?AGE_RECIPIENT(age公開鍵)を設定してください}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"   # 例: r2:trainingapp-backup (空ならローカル保存のみ)

set -a; . "./${ENV_FILE}"; set +a

mkdir -p "${BACKUP_DIR}"
umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="${BACKUP_DIR}/trainingapp-${stamp}.sql.gz.age"

# パスワードをコマンドラインに出さないためコンテナ内の環境変数を使う
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T db \
  sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --routines --no-tablespaces -uroot "$MYSQL_DATABASE"' \
  | gzip -9 \
  | age -r "${AGE_RECIPIENT}" -o "${file}"

[ -s "${file}" ] || { echo "backup is empty: ${file}" >&2; exit 1; }
echo "created ${file}"

if [ -n "${RCLONE_REMOTE}" ]; then
  rclone copy "${file}" "${RCLONE_REMOTE}/"
  rclone delete "${RCLONE_REMOTE}/" --min-age "${RETENTION_DAYS}d"
fi

find "${BACKUP_DIR}" -name 'trainingapp-*.sql.gz.age' -mtime "+${RETENTION_DAYS}" -delete
