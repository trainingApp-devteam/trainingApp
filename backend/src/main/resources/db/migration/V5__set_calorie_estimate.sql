ALTER TABLE set_records ADD COLUMN calorie_estimate_id BIGINT NULL;
ALTER TABLE set_records ADD CONSTRAINT fk_sets_calorie_estimate FOREIGN KEY (calorie_estimate_id) REFERENCES exercise_calorie_estimates(id);
