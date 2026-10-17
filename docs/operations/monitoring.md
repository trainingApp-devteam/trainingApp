# モニタリング設定

[インフラ・運用設計書](../detailed-design/infrastructure-design.md) 7章に基づき、少人数・単一サーバー向けの最小構成を定義する。

## 1. 実装済みの仕組み

| 項目 | 内容 |
| --- | --- |
| ヘルスチェック | Spring Boot Actuator。`/actuator/health`、`/actuator/health/liveness`、`/actuator/health/readiness`（認証不要）。公開環境ではCaddyが`/actuator/*`を404にし、外部へ出さない |
| コンテナ監視 | `docker-compose.prod.yml`のbackend/dbに`healthcheck`を設定。`docker compose ps`で`healthy`を確認 |
| リクエストID | すべてのレスポンスに`X-Request-Id`を付与し、ログ行にも`[requestId]`を出力。クライアントが`X-Request-Id`を送るとそれを引き継ぐ（英数字と`._-`、64文字まで） |
| エラー応答 | 想定外エラーは共通の`ApiError`形式で`requestId`/`traceId`相当のIDを返し、詳細はログにだけ出す |
| 起動停止 | graceful shutdown（20秒）。接続プール上限は`DB_POOL_MAX`で調整 |

## 2. 運用上の確認項目

| 確認 | 方法 | 頻度 | しきい値/対応 |
| --- | --- | --- | --- |
| 稼働 | 外形監視（UptimeRobot等の無料枠）で`https://<SITE_ADDRESS>/`を5分間隔 | 常時 | 2回連続失敗で通知 → [Runbook](runbook.md) |
| API応答 | 同じ外形監視でログイン画面のHTTP 200を確認 | 常時 | 同上 |
| コンテナ状態 | `docker compose ps` | 日次/障害時 | `unhealthy`/`restarting`は[Runbook](runbook.md)へ |
| ディスク | `df -h`、Dockerボリューム容量 | 週次 | 使用率80%超で原因調査・拡張 |
| メモリ | `docker stats --no-stream` | 週次/障害時 | backendが継続的に上限付近ならVPS増強を検討 |
| バックアップ | 最新ファイルの作成時刻・サイズ、保存先の存在 | 日次 | 24時間以上更新なしで調査 |
| 証明書 | ブラウザ/外形監視の証明書期限確認（Caddyが自動更新） | 月次 | 期限14日前に更新失敗がないかCaddyログ確認 |
| 無料枠/請求 | GHCR・R2等の使用量、請求通知 | 月次 | 上限の80%で見直し |

## 3. ログの扱い

- 参照: `docker compose logs --since 1h backend` / `caddy`。ログローテーションは`json-file`の`max-size`/`max-file`をDocker側で設定する。
- 障害調査ではユーザーから受け取った`X-Request-Id`（またはエラー応答のID）でbackendログを検索する。
- ログへ出さない: パスワード、Cookie、招待トークン、身体測定値。調査のために一時的にログレベルを上げる場合も、これらが出ないことを確認する。

## 4. 将来の拡張

- Prometheus形式のメトリクスが必要になったら、`micrometer-registry-prometheus`を追加し、Admin権限またはサーバー内部ネットワークに限定して公開する。
- クラウド運用に移す場合は、Application InsightsやCloudWatchのエージェントをコンテナへ追加し、ヘルスチェックと`X-Request-Id`をそのまま関連付けに使う。
