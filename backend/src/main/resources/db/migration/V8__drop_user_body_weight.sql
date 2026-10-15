-- 推定用の体重は、身体測定(body_measurements)の最新の体重を使うため、アカウント側の体重は廃止する
ALTER TABLE users DROP CONSTRAINT chk_users_body_weight;
ALTER TABLE users DROP COLUMN body_weight_kg;
