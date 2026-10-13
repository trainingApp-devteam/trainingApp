# リリースチェックリスト

リリース前後に確認する項目。完了した項目に日付と担当者を記録する。

## 1. リリースビルドの検証（開発PC/CI）

- [ ] `main`のCI（frontend / backend / e2e）がすべて成功している
- [ ] Backend: `cd backend && ./gradlew test bootJar` が成功し、`build/libs/*.jar`が生成される
- [ ] Frontend: `cd frontend && npm ci && npm run build` が成功し、`dist/`が生成される
- [ ] `docs/openapi.yaml`が実装と一致している（Backendの`generatedApiDocsMatchTheOpenApiContract`テストが成功）
- [ ] 秘密情報がコミットされていない（`git grep -n "PASSWORD"`で実値がない）

## 2. 公開前（初回のみ）

[インフラ・運用設計書 8章](../detailed-design/infrastructure-design.md)の公開前チェックリストを満たす。

- [ ] 無料枠・料金・上限・停止条件を公式情報で確認した
- [ ] [バックアップ](backup-restore.md)を取得し、別環境で復元テストをした
- [ ] HTTPS、Cookie属性（Secure/HttpOnly/SameSite）、DB非公開、Secrets設定を確認した
- [ ] Admin・一般利用者の権限と、承認待ちの扱いを本番設定で確認した
- [ ] データ保持・プライバシー告知・障害連絡方法を合意した

## 3. デプロイ

- [ ] リリース前のバックアップを取得した
- [ ] タグ`vX.Y.Z`を作成し、Releaseワークフローがイメージを公開した
- [ ] [デプロイ手順](deployment.md)に従って更新した
- [ ] [リリースノート](release-notes-template.md)を作成した

## 4. デプロイ後の検証・監視

- [ ] [Runbook 3章](runbook.md)の点検項目をすべて確認した
- [ ] 外形監視が成功している
- [ ] 公開後24時間、`docker compose logs backend`にエラーが継続していない
- [ ] 問題があれば[ロールバック](deployment.md#5-ロールバック)し、障害記録を残した
