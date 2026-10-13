#!/usr/bin/env bash
# backup.sh で作成した暗号化バックアップを、指定のDBへ復元する。
# 本番DBへ直接復元する前に、必ず別環境(検証用compose)で手順を確認すること。
# 使い方: AGE_IDENTITY=~/.age/key.txt infra/backup/restore.sh <backup-file.sql.gz.age>
set -euo pipefail

backup="${1:?復元するバックアップファイルを指定してください}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
AGE_IDENTITY="${AGE_IDENTITY:?AGE_IDENTITY(age秘密鍵ファイル)を設定してください}"

set -a; . "./${ENV_FILE}"; set +a

read -r -p "DB '${MYSQL_DATABASE}' を ${backup} の内容で上書きします。続行しますか? [yes/NO] " answer
[ "${answer}" = "yes" ] || { echo "中止しました"; exit 1; }

age -d -i "${AGE_IDENTITY}" "${backup}" | gunzip \
  | docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T db \
      sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"'

echo "restore finished. backendを再起動し、/actuator/health と主要画面を確認してください。"
