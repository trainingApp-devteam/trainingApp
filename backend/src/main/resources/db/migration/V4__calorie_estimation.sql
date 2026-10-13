ALTER TABLE exercises ADD COLUMN exercise_code VARCHAR(64) NULL;
ALTER TABLE exercises ADD COLUMN calorie_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exercises ADD CONSTRAINT uq_exercises_exercise_code UNIQUE (exercise_code);

UPDATE exercises SET name = 'ディップス・チンニングマシン' WHERE owner_user_id IS NULL AND name = 'ディップス・チンニング';

UPDATE exercises SET exercise_code = 'treadmill', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'トレッドミル';
UPDATE exercises SET exercise_code = 'upright_bike', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'アップライトバイク';
UPDATE exercises SET exercise_code = 'recumbent_bike', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'リカンベントバイク';
UPDATE exercises SET exercise_code = 'cross_trainer', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'クロストレーナー';
UPDATE exercises SET exercise_code = 'chest_press', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'チェストプレス';
UPDATE exercises SET exercise_code = 'lat_pulldown', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'ラットプルダウン';
UPDATE exercises SET exercise_code = 'overhead_press', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'オーバーヘッドプレス';
UPDATE exercises SET exercise_code = 'leg_extension', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'レッグエクステンション';
UPDATE exercises SET exercise_code = 'leg_curl', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'レッグカール';
UPDATE exercises SET exercise_code = 'leg_press', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'レッグプレス';
UPDATE exercises SET exercise_code = 'abdominal', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'アブドミナル';
UPDATE exercises SET exercise_code = 'back_extension', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'バックエクステンション';
UPDATE exercises SET exercise_code = 'decline_bench', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = '腹筋台';
UPDATE exercises SET exercise_code = 'dumbbell', calorie_enabled = FALSE WHERE owner_user_id IS NULL AND name = 'ダンベル';
UPDATE exercises SET exercise_code = 'smith_machine', calorie_enabled = FALSE WHERE owner_user_id IS NULL AND name = 'スミスマシン';
UPDATE exercises SET exercise_code = 'bench_press', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'ベンチプレス';
UPDATE exercises SET exercise_code = 'power_rack', calorie_enabled = FALSE WHERE owner_user_id IS NULL AND name = 'パワーラック';
UPDATE exercises SET exercise_code = 'dips_chinning', calorie_enabled = TRUE WHERE owner_user_id IS NULL AND name = 'ディップス・チンニングマシン';
UPDATE exercises SET exercise_code = 'squat', calorie_enabled = FALSE WHERE owner_user_id IS NULL AND name = 'スクワット';

INSERT INTO exercises (name, category, exercise_code, calorie_enabled) VALUES
    ('ヒップアブダクション・アダクション', '脚', 'hip_abduction_adduction', TRUE),
    ('背筋台', '背中', 'hyperextension_bench', TRUE);

CREATE TABLE exercise_calorie_rates (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    exercise_code VARCHAR(64) NOT NULL,
    basis VARCHAR(10) NOT NULL,
    rpe_min TINYINT NOT NULL,
    rpe_max TINYINT NOT NULL,
    met_value DECIMAL(4,2) NOT NULL,
    seconds_per_rep DECIMAL(5,2) NULL,
    version INT NOT NULL DEFAULT 1,
    source VARCHAR(500) NOT NULL,
    effective_from DATE NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_exercise_calorie_rates_exercise
        FOREIGN KEY (exercise_code) REFERENCES exercises (exercise_code),
    CONSTRAINT uq_exercise_rate_band_version
        UNIQUE (exercise_code, basis, rpe_min, rpe_max, version),
    CONSTRAINT chk_exercise_rate_basis CHECK (basis IN ('REP', 'MINUTE')),
    CONSTRAINT chk_exercise_rate_rpe CHECK (rpe_min BETWEEN 1 AND 10 AND rpe_max BETWEEN rpe_min AND 10),
    CONSTRAINT chk_exercise_rate_met CHECK (met_value > 0),
    CONSTRAINT chk_exercise_rate_rep_duration CHECK (
        (basis = 'REP' AND seconds_per_rep > 0) OR
        (basis = 'MINUTE' AND seconds_per_rep IS NULL)
    )
);

CREATE TABLE exercise_calorie_estimates (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    exercise_code VARCHAR(64) NOT NULL,
    rate_id BIGINT NOT NULL,
    basis VARCHAR(10) NOT NULL,
    rpe TINYINT NOT NULL,
    body_weight_kg DECIMAL(6,2) NOT NULL,
    external_load_kg DECIMAL(7,2) NULL,
    reps INT NULL,
    duration_seconds INT NULL,
    active_seconds DECIMAL(8,2) NOT NULL,
    estimated_calories_kcal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_calorie_estimates_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_calorie_estimates_exercise
        FOREIGN KEY (exercise_code) REFERENCES exercises (exercise_code),
    CONSTRAINT fk_calorie_estimates_rate
        FOREIGN KEY (rate_id) REFERENCES exercise_calorie_rates (id),
    CONSTRAINT chk_calorie_estimate_values CHECK (
        (basis = 'REP' AND reps > 0 AND duration_seconds IS NULL) OR
        (basis = 'MINUTE' AND duration_seconds > 0 AND reps IS NULL)
    ),
    CONSTRAINT chk_calorie_estimate_nonnegative CHECK (
        body_weight_kg > 0 AND active_seconds > 0 AND estimated_calories_kcal >= 0
    )
);

INSERT INTO exercise_calorie_rates
    (exercise_code, basis, rpe_min, rpe_max, met_value, seconds_per_rep, source, effective_from)
VALUES
    ('treadmill', 'MINUTE', 1, 4, 3.50, NULL, '2024 Adult Compendium of Physical Activities; representative low-intensity estimate, RPE mapping is an application estimate', '2026-10-13'),
    ('treadmill', 'MINUTE', 5, 7, 6.00, NULL, '2024 Adult Compendium of Physical Activities; representative moderate-intensity estimate, RPE mapping is an application estimate', '2026-10-13'),
    ('treadmill', 'MINUTE', 8, 10, 8.00, NULL, '2024 Adult Compendium of Physical Activities; representative vigorous-intensity estimate, RPE mapping is an application estimate', '2026-10-13'),
    ('upright_bike', 'MINUTE', 1, 4, 3.50, NULL, '2024 Adult Compendium of Physical Activities; stationary cycling 25-30 W reference, RPE mapping is an application estimate', '2026-10-13'),
    ('upright_bike', 'MINUTE', 5, 7, 6.00, NULL, '2024 Adult Compendium of Physical Activities; stationary cycling 90-100 W reference, RPE mapping is an application estimate', '2026-10-13'),
    ('upright_bike', 'MINUTE', 8, 10, 8.00, NULL, '2024 Adult Compendium of Physical Activities; stationary cycling 126-150 W reference, RPE mapping is an application estimate', '2026-10-13'),
    ('recumbent_bike', 'MINUTE', 1, 4, 3.50, NULL, '2024 Adult Compendium of Physical Activities; stationary cycling 25-30 W reference, RPE mapping is an application estimate', '2026-10-13'),
    ('recumbent_bike', 'MINUTE', 5, 7, 6.00, NULL, '2024 Adult Compendium of Physical Activities; stationary cycling 90-100 W reference, RPE mapping is an application estimate', '2026-10-13'),
    ('recumbent_bike', 'MINUTE', 8, 10, 8.00, NULL, '2024 Adult Compendium of Physical Activities; stationary cycling 126-150 W reference, RPE mapping is an application estimate', '2026-10-13'),
    ('cross_trainer', 'MINUTE', 1, 4, 3.50, NULL, '2024 Adult Compendium of Physical Activities; representative low-intensity estimate, RPE mapping is an application estimate', '2026-10-13'),
    ('cross_trainer', 'MINUTE', 5, 7, 6.00, NULL, '2024 Adult Compendium of Physical Activities; representative moderate-intensity estimate, RPE mapping is an application estimate', '2026-10-13'),
    ('cross_trainer', 'MINUTE', 8, 10, 8.00, NULL, '2024 Adult Compendium of Physical Activities; representative vigorous-intensity estimate, RPE mapping is an application estimate', '2026-10-13'),
    ('chest_press', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('chest_press', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('lat_pulldown', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('lat_pulldown', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('overhead_press', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('overhead_press', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('leg_extension', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('leg_extension', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('leg_curl', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('leg_curl', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('leg_press', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('leg_press', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('hip_abduction_adduction', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('hip_abduction_adduction', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('abdominal', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('abdominal', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('back_extension', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('back_extension', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('decline_bench', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('decline_bench', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('hyperextension_bench', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('hyperextension_bench', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('bench_press', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('bench_press', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('dips_chinning', 'REP', 1, 6, 3.50, 3.00, '2024 Adult Compendium general resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13'),
    ('dips_chinning', 'REP', 7, 10, 6.00, 3.00, '2024 Adult Compendium vigorous resistance-training MET estimate; RPE band and 3-second repetition duration are application assumptions', '2026-10-13');