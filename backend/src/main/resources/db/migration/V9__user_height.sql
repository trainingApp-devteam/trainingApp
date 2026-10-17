-- 身長は基本的に変わらないため、身体測定の履歴ではなく利用者ごとに1つだけ保持する
ALTER TABLE users ADD COLUMN height_cm DECIMAL(4,1) NULL;
ALTER TABLE users ADD CONSTRAINT chk_users_height CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 300));

-- 既存の身長測定は最新の値だけを引き継ぐ
UPDATE users SET height_cm = (
    SELECT bm.measurement_value
    FROM body_measurements bm
    JOIN measurement_types mt ON mt.id = bm.measurement_type_id
    WHERE bm.user_id = users.id AND mt.code = 'height_cm'
    ORDER BY bm.measured_at DESC, bm.id DESC
    LIMIT 1
);
DELETE FROM body_measurements
WHERE measurement_type_id IN (SELECT id FROM measurement_types WHERE code = 'height_cm');

-- 身体測定では体重・体脂肪率のみ登録できる
UPDATE measurement_types SET enabled = FALSE WHERE code = 'height_cm';
