# trainingApp
筋トレ記録アプリ

## Backend

Java 17以降が必要です。Gradle Wrapperを使用し、ローカルではH2で起動できます。

```powershell
Push-Location backend
$env:TRAININGAPP_ADMIN_USERNAME = "admin"
$env:TRAININGAPP_ADMIN_PASSWORD = "12文字以上の初期パスワード"
.\gradlew.bat bootRun --args='--spring.profiles.active=dev'
Pop-Location
```

初回起動時、ユーザーテーブルが空で、上記の両環境変数が設定されている場合のみAdminを作成します。パスワードはBCryptで保存され、起動後は環境変数を解除してください。初期Adminは最低12文字のパスワードが必要です。

一般ユーザーはAdminが `POST /api/v1/admin/invitations` で発行した招待トークンから申請します。申請後はAdminが `GET /api/v1/admin/users/pending` で確認し、承認または却下します。招待トークンは一度だけ返され、既定7日（最大30日）で失効します。

API契約は [`docs/openapi.yaml`](docs/openapi.yaml)、ベースパスは `/api/v1` です。Cookieセッションを使用し、状態変更要求にはCSRFトークンが必要です。最初に `GET /api/v1/auth/csrf` を呼び、`XSRF-TOKEN` Cookieの値を `X-XSRF-TOKEN` ヘッダーへ送ってください。

MySQLで実行する場合は `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` を設定してください。本番では `SESSION_COOKIE_SECURE=true` を維持し、HTTPS経由で配信してください。開発プロファイルはHTTPローカル接続のためCookieのSecure属性を無効にします。

テストは `Push-Location backend; .\gradlew.bat test; Pop-Location` で実行します。

## Frontend と Backend の接続

別々のPowerShellターミナルでBackendとFrontendを起動します。Frontendの`/api`リクエストはViteが`http://localhost:8080`へ転送します。

Backend:

```powershell
Push-Location backend
$env:TRAININGAPP_ADMIN_USERNAME = "admin"
$env:TRAININGAPP_ADMIN_PASSWORD = "12文字以上の初期パスワード"
.\gradlew.bat bootRun --args='--spring.profiles.active=dev'
```

Frontend:

```powershell
Push-Location frontend
npm install
npm run dev
```

表示されたViteのURL（通常は`http://localhost:5173`）を開き、作成したAdminでログインできます。一般ユーザーはAdminが発行した招待コードから登録申請し、Admin承認後にログインします。状態変更APIのCSRFトークンとセッションCookieはFrontendのAPIクライアントが処理します。

開発プロファイルのDBはH2インメモリです。Frontendを再読み込みしてもデータは保持されますが、Backendを再起動するとユーザー、記録、身体測定、ルーティンは初期化されます。永続DB接続は別タスクです。

MSWを使う場合だけ、Frontend起動前に`$env:VITE_USE_MSW = "true"`を設定します。既定では実Backendへ接続します。
