-- 種目ごとに記録形式（回数=REP / 時間=MINUTE）を1つに決める。メニュー作成では変更できない
-- 有酸素マシンは回数では動作時間を決められないため時間、それ以外の筋トレ種目は回数
ALTER TABLE exercises ADD COLUMN record_type VARCHAR(10) NOT NULL DEFAULT 'REP';

UPDATE exercises SET record_type = 'MINUTE'
WHERE exercise_code IN ('treadmill', 'upright_bike', 'recumbent_bike', 'cross_trainer');

ALTER TABLE exercises ADD CONSTRAINT chk_exercises_record_type CHECK (record_type IN ('REP', 'MINUTE'));
