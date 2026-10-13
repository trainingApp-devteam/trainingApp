# 運用Runbook（ログ確認・障害対応）

対象: [デプロイ手順](deployment.md)の構成（Caddy + backend + MySQL）。運用担当者向け。DBを直接手修正せず、**バックアップ取得 → 原因調査 → 復旧**の順に進める。

## 1. 基本コマンド

すべて`/opt/trainingapp`で実行する（`.env.prod`を指定）。

```bash
alias dc='docker compose --env-file .env.prod -f docker-compose.prod.yml'
dc ps                              # 状態(healthy/unhealthy/restarting)
dc logs --since 30m backend        # APIログ
dc logs --since 30m caddy          # アクセス・証明書ログ
dc logs --since 30m db             # DBログ
dc restart backend                 # APIのみ再起動
```

## 2. 状況別の対応

| 症状 | 確認 | 対応 |
| --- | --- | --- |
| サイトが開かない | `dc ps`でcaddyが`Up`か。DNS・証明書(`dc logs caddy`) | caddy再起動。証明書取得失敗は80/443の到達性とDNSを確認 |
| 画面は出るがAPIがエラー | `dc ps`でbackendが`healthy`か。`dc logs backend` | 後述「backendが起動しない」「DB接続エラー」 |
| backendが起動しない | `dc logs backend`のFlyway/接続エラー | マイグレーション失敗は修正せず、前バージョンへ[ロールバック](deployment.md#5-ロールバック)し、原因を調査 |
| DB接続エラー | `dc ps`でdbが`healthy`か。ディスク空き(`df -h`) | db再起動。ディスク逼迫は不要ログ・古いバックアップを整理。復旧しなければ[復元](backup-restore.md) |
| 特定ユーザーのエラー | ユーザーから`X-Request-Id`（エラー応答の`requestId`）を聞く | `dc logs backend \| grep <requestId>`でスタックトレースを確認 |
| ログインできない | 承認待ち(`PENDING_APPROVAL`)か、招待が失効/取消か | Adminが`GET /admin/users/pending`で確認・承認。パスワード再設定は手動対応（Adminが新しい招待を発行） |
| メモリ不足/OOM | `docker stats --no-stream`、`dmesg \| grep -i oom` | backend再起動、`JAVA_TOOL_OPTIONS`の見直し、VPS増強を検討 |
| 全データが見えない | 復元ミス・別DBへの接続を疑う | 直ちに書き込みを止め(`dc stop backend`)、バックアップから確認・復元 |

## 3. 点検項目（デプロイ後・復旧後）

1. `https://<SITE_ADDRESS>/`が表示される。
2. Adminでログインできる。
3. 記録の作成・履歴詳細の表示と編集・身体測定の登録ができる。
4. カロリー推定対象種目で推定kcalが表示される（体重登録済みのアカウント）。
5. `dc ps`の全サービスが`healthy`/`Up`。
6. 外部から`/actuator/health`が404（非公開）である。

## 4. 連絡・記録

- 障害時は発生・検知・復旧の時刻、影響範囲、原因、再発防止策を下記テンプレートで記録する。
- 個人情報（身体測定値など）をチケットやチャットへ貼らない。

```
## 障害記録 YYYY-MM-DD
- 発生/検知/復旧: 
- 影響:
- 原因:
- 対応:
- 再発防止:
```

## 5. 定期作業

| 周期 | 作業 |
| --- | --- |
| 日次 | バックアップ成功確認 |
| 週次 | ディスク・メモリ確認、`dc logs`のエラー傾向確認 |
| 月次 | OS・Docker・イメージの更新適用（適用前にバックアップ）、無料枠/請求確認 |
| 四半期 | [復元テスト](backup-restore.md#4-復元テスト四半期ごと初回運用前) |
