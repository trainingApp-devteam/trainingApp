ALTER TABLE routine_exercises
    ADD COLUMN target_type VARCHAR(8) NOT NULL DEFAULT 'reps';

ALTER TABLE routine_exercises
    ADD COLUMN target_reps INT NULL DEFAULT 8;

ALTER TABLE routine_exercises
    ADD COLUMN target_duration_seconds INT NULL;

ALTER TABLE routine_exercises
    ADD COLUMN target_weight_kg DECIMAL(7,2) NULL;