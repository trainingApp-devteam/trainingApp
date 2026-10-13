# trainingApp
筋トレ記録アプリ

## テスト環境

Docker Desktopを起動し、リポジトリルートで実行します。

```powershell
docker compose up --build
```

- Frontend: http://localhost:5173
- Calorie API: http://localhost:8080
- MySQL: 127.0.0.1:3306（ローカル接続のみ）

初回起動時にFlywayが標準種目と推定係数を投入します。推定にはRPE、体重、動作時間を使い、入力と推定結果は`exercise_calorie_estimates`へ保存します。DB資格情報はローカルテスト専用です。

DBを残して停止する場合は`docker compose down`、全テストデータを削除して初期化する場合は`docker compose down -v`を使います。
