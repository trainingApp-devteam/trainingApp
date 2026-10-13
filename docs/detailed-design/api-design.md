# API設計書

## 1. 文書情報

| 項目 | 内容 |
| --- | --- |
| バージョン | 1.0 |
| 状態 | 初版案 |
| ベースパス | `/api/v1` |
| 主な利用者 | フロントエンド/バックエンド開発者、APIレビュー担当 |

## 2. 共通仕様

- プロトコル: HTTPS（本番）、JSON、UTF-8。
- 時刻はISO 8601形式。サーバー処理時刻はUTCで返す。トレーニング実施日は`YYYY-MM-DD`。
- 認証はセッションCookieを基本とする。Cookie名・属性の詳細は[セキュリティ設計書](security-design.md)を参照。
- APIはリクエスト中のuserIdを受け取って所有者を決定しない。認証済みセッションからユーザーIDを取得する。
- 一覧はページングする。既定ページサイズ・最大ページサイズは実装時に設定として固定する。
- APIの破壊的な変更はバージョン付きパスまたは移行期間を設ける。

## 3. 共通レスポンス

成功時は通常2xxを返す。削除成功は`204 No Content`を基本とする。エラーは次の形式に統一する。

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力内容を確認してください。",
  "details": [
    { "field": "username", "reason": "FORMAT_INVALID" }
  ],
  "requestId": "server-generated-id"
}
```

`details`は画面で項目エラーを表示できる範囲の情報とし、スタックトレース、SQL、内部パス、パスワード等を返さない。

## 4. エンドポイント一覧

| Method | Path | 認証/権限 | 用途 |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | 公開 | ユーザー名・パスワードでログイン |
| `POST` | `/auth/logout` | ログイン必須 | セッション無効化 |
| `POST` | `/auth/refresh` | ログイン必須 | セッションID更新 |
| `GET` | `/auth/me` | ログイン必須 | 自分のアカウント情報 |
| `GET` | `/auth/csrf` | 公開 | CSRFトークン取得 |
| `POST` | `/invitations/accept` | 有効な招待トークン | アカウント申請。状態は承認待ち |
| `POST` | `/admin/invitations` | Admin | 招待発行 |
| `GET` | `/admin/users/pending` | Admin | 承認待ち一覧 |
| `POST` | `/admin/users/{id}/activate` | Admin | アカウント承認・有効化 |
| `POST` | `/admin/users/{id}/reject` | Admin | 申請却下 |
| `POST` | `/admin/invitations/{id}/revoke` | Admin | 未使用招待の失効 |
| `GET`, `POST` | `/exercises` | ログイン | 種目一覧（名称/カテゴリ検索）、独自種目作成 |
| `GET`, `PUT`, `DELETE` | `/exercises/{id}` | ログイン、所有者/標準種目ルール | 詳細、独自種目変更・削除 |
| `GET`, `POST` | `/routines` | ログイン、本人データ | メニュー一覧・作成 |
| `GET`, `PUT`, `DELETE` | `/routines/{id}` | ログイン、本人データ | メニュー詳細・更新・削除 |
| `GET`, `POST` | `/training-sessions` | ログイン、本人データ | 履歴一覧・記録作成 |
| `GET`, `PUT`, `DELETE` | `/training-sessions/{id}` | ログイン、本人データ | 記録詳細・更新・個別削除 |
| `GET`, `POST` | `/body-measurements` | ログイン、本人データ | 測定一覧・追加 |
| `PUT`, `DELETE` | `/body-measurements/{id}` | ログイン、本人データ | 測定更新・個別削除 |
| `GET` | `/statistics/exercises/{exerciseId}` | ログイン、本人データ | 種目別推移 |
| `GET` | `/exercises/{id}/calorie-rates` | ログイン | 種目・記録形式・RPE帯別のMET係数 |
| `POST` | `/calorie-estimates` | ログイン | 標準種目の消費カロリーを推定し、入力・係数・結果を保存 |

アカウント削除と利用者の全データ一括削除に対応するAPIは初期リリースで作成しない。

## 5. 認証・招待API

### 5.1 ログイン

`POST /auth/login`

```json
{
  "username": "user-name",
  "password": "user-supplied-password"
}
```

成功時は`200`とアカウント概要を返し、セッションCookieを設定する。ユーザー名不明、パスワード不一致、承認待ち、却下アカウントはログイン不可とする。外部にアカウント状態を漏らさないよう、失敗メッセージは統一する。

### 5.2 招待の受諾・アカウント申請

`POST /invitations/accept`

```json
{
  "token": "one-time-invitation-token",
  "username": "new-user",
  "displayName": "表示名",
  "password": "user-supplied-password"
}
```

成功時は`201 Created`とし、`PENDING_APPROVAL`で作成されたことだけを返す。セッションは発行しない。トークンが無効、失効、期限切れ、使用済みの場合は`400`または`410`を返す。

### 5.3 Admin承認

`POST /admin/users/{id}/activate`で対象が承認待ちであることを検証し、`ACTIVE`へ遷移する。処理は冪等とし、承認済みに対する再実行は現在状態を返すか`409`とする。`POST /admin/users/{id}/reject`は`REJECTED`へ遷移する。一般利用者には`403`。

## 6. トレーニング記録API

### 6.1 作成例

`POST /training-sessions`

```json
{
  "trainingDate": "2026-09-26",
  "note": "任意メモ",
  "exercises": [
    {
      "exerciseId": 12,
      "displayOrder": 1,
      "sets": [
        { "setNumber": 1, "reps": 10, "durationSeconds": null, "weightKg": 40.0 },
        { "setNumber": 2, "reps": null, "durationSeconds": 45, "weightKg": null }
      ]
    }
  ]
}
```

`reps`と`durationSeconds`の片方だけを指定する。両方NULLまたは両方指定は`400 VALIDATION_ERROR`とする。`weightKg`は任意。所有者IDは受け付けず、認証ユーザーから設定する。

### 6.2 一覧と更新

`GET /training-sessions`は`from`, `to`, `exerciseId`, `page`, `size`を任意指定する。結果は実施日降順、同日は作成日時降順。`PUT`は対象記録の全体更新とし、未指定項目の扱いを部分更新と混同しない。部分更新が必要になった場合は`PATCH`の契約を別途定義する。

他ユーザーのIDを指定した取得・更新・削除は`404 NOT_FOUND`相当とし、存在有無を区別できない応答にする。

### 6.3 ルーティン

`GET /routines`は本人のルーティン一覧を返す。`POST`/`PUT`では`exerciseIds`の順序に対応する`exerciseTargets`を任意指定し、種目ごとの回数または時間と負荷を保存する。目標値を省略した既存クライアント要求は8回として扱う。

```json
{
  "name": "有酸素メニュー",
  "exerciseIds": [1],
  "exerciseTargets": [
    { "exerciseId": 1, "type": "time", "durationSeconds": 45, "weightKg": 2.5 }
  ]
}
```

## 7. 身体測定API

`GET /body-measurements`は`measurementTypeCode`, `from`, `to`, `page`, `size`を受け取る。`POST`の例:

```json
{
  "measurementTypeCode": "weight_kg",
  "measuredAt": "2026-09-26T07:30:00Z",
  "value": 68.4
}
```

サーバーは有効な項目コード、利用者の所有範囲、項目固有の単位・値範囲を検証する。レスポンスには項目コード、表示名、値、単位、測定日時を含める。同日に複数値を許可する。

## 8. 消費カロリー・集計

- `GET /statistics/exercises/{exerciseId}`は本人の種目履歴のみ返す。期間指定を受け付ける。
- 最大重量は重量が存在するセットから計算する。
- トレーニング量は重量と回数が両方存在するセットのみ`weightKg * reps`で集計する。時間セットは含めない。
- `POST /calorie-estimates`は`exerciseCode`, `basis`, `rpe`, `bodyWeightKg`と、回数形式なら`reps`、時間形式なら`durationSeconds`を受け取る。`externalLoadKg`は任意。
- 係数はサーバー側のDBから種目・形式・RPE帯で選択する。クライアントが送信したMETや推定カロリー値は信用しない。
- 回数形式はDBの`secondsPerRep × reps`を動作秒数とし、時間形式は`durationSeconds`を使う。MET式で計算後、係数IDと入力を含む推定結果をDBへ保存する。
- 未対応の独自種目・器具項目・負荷帯は`422`とし、カロリーを0に偽装しない。
- `GET /exercises/{id}/calorie-rates`は`basis`, `rpeMin`, `rpeMax`, `metValue`, `secondsPerRep`, `version`, `source`を返す。係数管理APIは設けず、Flyway seedで登録する。
- 消費カロリーは推定値として表示し、医学的・生理学的な精度を保証しない。

## 9. CSVエクスポート

本人データCSVエクスポートは初期リリースに含めないため、CSVを返すAPIは実装しない。

## 10. HTTPステータス

| Status | 用途 |
| --- | --- |
| `200` | 取得・更新・ログイン成功 |
| `201` | 新規作成成功 |
| `204` | 個別削除・ログアウト成功 |
| `400` | 入力形式・業務入力検証エラー |
| `401` | 未認証・認証失敗 |
| `403` | Admin権限がない操作 |
| `404` | 存在しない、または所有権のない対象 |
| `409` | ユーザー名重複、状態競合等 |
| `410` | 期限切れ/失効招待（存在情報の扱いは脅威評価で決定） |
| `429` | ログイン等のレート制限 |
| `500` | 想定外のサーバーエラー。詳細はログのみ |

## 11. API横断テスト要件

- 一般利用者Aが利用者Bの全てのID指定APIを試しても取得・変更できない。
- 未認証、承認待ち、却下、停止ユーザーの認証保護APIを拒否する。
- Admin APIは一般利用者から実行できない。
- POST/PUTの入力値、回数/時間の排他、単位・範囲、ページサイズを検証する。
- 個別削除は所有者本人に限られ、他ユーザーのデータを削除できない。
