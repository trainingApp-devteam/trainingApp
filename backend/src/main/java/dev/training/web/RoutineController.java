package dev.training.web;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/routines")
public class RoutineController {
    private final JdbcTemplate jdbc;

    public RoutineController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    List<Map<String, Object>> list(Authentication authentication) {
        long userId = userId(authentication.getName());
        return jdbc.query("SELECT id FROM routines WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
                (row, index) -> readRoutine(row.getLong(1), userId), userId);
    }

    @GetMapping("/{id}")
    Map<String, Object> get(@PathVariable long id, Authentication authentication) {
        return readRoutine(id, userId(authentication.getName()));
    }

    @PostMapping
    @Transactional
    ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body, Authentication authentication) {
        long ownerId = userId(authentication.getName());
        ValidatedRoutine input = validate(body, ownerId);
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO routines (user_id, name, description) VALUES (?, ?, ?)", new String[] {"id"});
            statement.setLong(1, ownerId);
            statement.setString(2, input.name());
            statement.setString(3, input.description());
            return statement;
        }, keys);
        Number key = keys.getKey();
        if (key == null) {
            throw new IllegalStateException("Routine insert did not return an identifier");
        }
        long id = key.longValue();
        insertRoutineExercises(id, input.exerciseIds());
        return ResponseEntity.status(HttpStatus.CREATED).body(readRoutine(id, ownerId));
    }

    @PutMapping("/{id}")
    @Transactional
    Map<String, Object> update(@PathVariable long id, @RequestBody Map<String, Object> body, Authentication authentication) {
        long ownerId = userId(authentication.getName());
        ensureOwned(id, ownerId);
        ValidatedRoutine input = validate(body, ownerId);
        jdbc.update("UPDATE routines SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND user_id = ?",
                input.name(), input.description(), id, ownerId);
        jdbc.update("DELETE FROM routine_exercises WHERE routine_id = ?", id);
        insertRoutineExercises(id, input.exerciseIds());
        return readRoutine(id, ownerId);
    }

    @DeleteMapping("/{id}")
    @Transactional
    ResponseEntity<Void> delete(@PathVariable long id, Authentication authentication) {
        long ownerId = userId(authentication.getName());
        ensureOwned(id, ownerId);
        jdbc.update("DELETE FROM routine_exercises WHERE routine_id = ?", id);
        jdbc.update("DELETE FROM routines WHERE id = ? AND user_id = ?", id, ownerId);
        return ResponseEntity.noContent().build();
    }

    private ValidatedRoutine validate(Map<String, Object> body, long ownerId) {
        String name = ApiValues.text(body, "name", true, 100);
        String description = ApiValues.text(body, "description", false, 500);
        List<?> ids = ApiValues.list(body.get("exerciseIds"), "exerciseIds", true);
        if (ids.isEmpty() || ids.size() > 100) {
            throw ApiValues.invalid("exerciseIds");
        }
        List<?> targets = body.containsKey("exerciseTargets")
                ? ApiValues.list(body.get("exerciseTargets"), "exerciseTargets", true) : List.of();
        if (!targets.isEmpty() && targets.size() != ids.size()) {
            throw ApiValues.invalid("exerciseTargets");
        }
        List<RoutineExercise> exerciseIds = new ArrayList<>();
        for (int index = 0; index < ids.size(); index++) {
            long id = ApiValues.positiveLong(ids.get(index), "exerciseIds");
            Integer visible = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM exercises WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)",
                    Integer.class, id, ownerId);
            if (visible == null || visible == 0) {
                throw ApiValues.invalid("exerciseIds");
            }
            String type = "reps";
            Integer reps = 8;
            Integer duration = null;
            BigDecimal weight = null;
            if (!targets.isEmpty()) {
                Map<String, Object> target = ApiValues.object(targets.get(index), "exerciseTargets");
                if (ApiValues.positiveLong(target.get("exerciseId"), "exerciseTargets") != id) {
                    throw ApiValues.invalid("exerciseTargets");
                }
                type = ApiValues.text(target, "type", true, 8);
                if ("reps".equals(type)) {
                    reps = ApiValues.positiveInt(target.get("reps"), "reps");
                } else if ("time".equals(type)) {
                    reps = null;
                    duration = ApiValues.positiveInt(target.get("durationSeconds"), "durationSeconds");
                } else {
                    throw ApiValues.invalid("type");
                }
                if (target.get("weightKg") != null) {
                    weight = ApiValues.decimal(target.get("weightKg"), "weightKg", BigDecimal.ZERO,
                            new BigDecimal("99999.99"));
                }
            }
            exerciseIds.add(new RoutineExercise(id, type, reps, duration, weight));
        }
        return new ValidatedRoutine(name, description, exerciseIds);
    }

    private void insertRoutineExercises(long routineId, List<RoutineExercise> exerciseIds) {
        for (int index = 0; index < exerciseIds.size(); index++) {
            RoutineExercise exercise = exerciseIds.get(index);
            jdbc.update("INSERT INTO routine_exercises (routine_id, exercise_id, display_order, target_type, target_reps, target_duration_seconds, target_weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    routineId, exercise.exerciseId(), index + 1, exercise.type(), exercise.reps(),
                    exercise.durationSeconds(), exercise.weightKg());
        }
    }

    private Map<String, Object> readRoutine(long id, long userId) {
        Map<String, Object> routine = jdbc.query(
                        "SELECT id, name, description FROM routines WHERE id = ? AND user_id = ?",
                        row -> {
                            if (!row.next()) {
                                return null;
                            }
                            Map<String, Object> result = new LinkedHashMap<>();
                            result.put("id", row.getLong("id"));
                            result.put("name", row.getString("name"));
                            result.put("description", row.getString("description"));
                            return result;
                        }, id, userId)
                ;
        if (routine == null) {
            throw ApiValues.notFound();
        }
        List<Map<String, Object>> exercises = jdbc.query(
                "SELECT e.id, e.owner_user_id, e.name, e.category, e.description, re.target_type, re.target_reps, re.target_duration_seconds, re.target_weight_kg FROM routine_exercises re "
                        + "JOIN exercises e ON e.id = re.exercise_id WHERE re.routine_id = ? ORDER BY re.display_order",
                (row, index) -> {
                    Map<String, Object> exercise = new LinkedHashMap<>();
                    exercise.put("id", row.getLong("id"));
                    exercise.put("shared", row.getObject("owner_user_id") == null);
                    exercise.put("name", row.getString("name"));
                    exercise.put("category", row.getString("category"));
                    exercise.put("description", row.getString("description"));
                    exercise.put("targetType", row.getString("target_type"));
                    exercise.put("targetReps", (Integer) row.getObject("target_reps"));
                    exercise.put("targetDurationSeconds", (Integer) row.getObject("target_duration_seconds"));
                    exercise.put("targetWeightKg", row.getBigDecimal("target_weight_kg"));
                    return exercise;
                }, id);
        routine.put("exerciseIds", exercises.stream().map(exercise -> exercise.get("id")).toList());
        routine.put("exercises", exercises);
        routine.put("exerciseTargets", exercises.stream().map(exercise -> {
            Map<String, Object> target = new LinkedHashMap<>();
            target.put("exerciseId", exercise.get("id"));
            target.put("exerciseName", exercise.get("name"));
            target.put("type", exercise.get("targetType"));
            target.put("reps", exercise.get("targetReps"));
            target.put("durationSeconds", exercise.get("targetDurationSeconds"));
            target.put("weightKg", exercise.get("targetWeightKg"));
            return target;
        }).toList());
        return routine;
    }

    private void ensureOwned(long id, long userId) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM routines WHERE id = ? AND user_id = ?", Integer.class, id, userId);
        if (count == null || count == 0) {
            throw ApiValues.notFound();
        }
    }

    private long userId(String username) {
        return jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
    }

    private record ValidatedRoutine(String name, String description, List<RoutineExercise> exerciseIds) {
    }

    private record RoutineExercise(long exerciseId, String type, Integer reps, Integer durationSeconds, BigDecimal weightKg) {
    }
}