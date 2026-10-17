-- 独自種目（利用者が作成する種目）の仕様を廃止し、種目は標準種目だけにする。
-- 独自種目を参照する記録・メニューの行を先に削除する（適用前にバックアップを取ること）
DELETE FROM set_records
WHERE session_exercise_id IN (
    SELECT se.id FROM session_exercises se
    JOIN exercises e ON e.id = se.exercise_id
    WHERE e.owner_user_id IS NOT NULL
);
DELETE FROM session_exercises
WHERE exercise_id IN (SELECT id FROM exercises WHERE owner_user_id IS NOT NULL);
-- 独自種目だけで構成されていた記録は、種目が無くなるため記録ごと削除する
DELETE FROM training_sessions
WHERE id NOT IN (SELECT session_id FROM session_exercises);
DELETE FROM routine_exercises
WHERE exercise_id IN (SELECT id FROM exercises WHERE owner_user_id IS NOT NULL);
DELETE FROM exercises WHERE owner_user_id IS NOT NULL;

ALTER TABLE exercises DROP CONSTRAINT fk_exercises_owner;
ALTER TABLE exercises DROP INDEX idx_exercises_owner_name;
ALTER TABLE exercises DROP COLUMN owner_user_id;
