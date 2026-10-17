CREATE INDEX idx_session_exercises_exercise ON session_exercises (exercise_id, session_id);
CREATE INDEX idx_calorie_rates_lookup ON exercise_calorie_rates (exercise_code, basis, enabled);
CREATE INDEX idx_calorie_estimates_user_created ON exercise_calorie_estimates (user_id, created_at);
