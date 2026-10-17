-- 器具名の標準種目（ダンベル/スミスマシン/パワーラック）とスクワットも、一般的な筋トレとして推定対象にする
UPDATE exercises SET calorie_enabled = TRUE
WHERE owner_user_id IS NULL AND exercise_code IN ('dumbbell', 'smith_machine', 'power_rack', 'squat');

INSERT INTO exercise_calorie_rates
    (exercise_code, basis, rpe_min, rpe_max, met_value, seconds_per_rep, source, effective_from)
VALUES
    ('dumbbell', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; equipment item treated as general resistance training, RPE band and 3-second repetition duration are application assumptions', '2026-10-17'),
    ('dumbbell', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; equipment item treated as general resistance training, RPE band and 3-second repetition duration are application assumptions', '2026-10-17'),
    ('smith_machine', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; equipment item treated as general resistance training, RPE band and 3-second repetition duration are application assumptions', '2026-10-17'),
    ('smith_machine', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; equipment item treated as general resistance training, RPE band and 3-second repetition duration are application assumptions', '2026-10-17'),
    ('power_rack', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; equipment item treated as general resistance training, RPE band and 3-second repetition duration are application assumptions', '2026-10-17'),
    ('power_rack', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; equipment item treated as general resistance training, RPE band and 3-second repetition duration are application assumptions', '2026-10-17'),
    ('squat', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-17'),
    ('squat', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-17');

-- 筋トレ種目を時間で記録したセット（保持系など）は、入力された秒数を動作時間として同じMETで推定する
INSERT INTO exercise_calorie_rates
    (exercise_code, basis, rpe_min, rpe_max, met_value, seconds_per_rep, source, effective_from)
SELECT exercise_code, 'MINUTE', rpe_min, rpe_max, met_value, NULL,
       'Same MET as the REP band of this exercise; the entered set duration is used as active time (application assumption)',
       '2026-10-17'
FROM exercise_calorie_rates
WHERE basis = 'REP' AND enabled = TRUE;
