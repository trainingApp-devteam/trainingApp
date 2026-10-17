package dev.training.web;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/training-sessions")
public class TrainingSessionController {
    private final JdbcTemplate jdbc;

    public TrainingSessionController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    Map<String, Object> list(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Long exerciseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        if (page < 0 || size < 1 || size > 100) {
            throw ApiValues.invalid("page");
        }
        long userId = userId(authentication.getName());
        StringBuilder where = new StringBuilder(" FROM training_sessions s WHERE s.user_id = ?");
        List<Object> parameters = new ArrayList<>();
        parameters.add(userId);
        if (from != null) {
            where.append(" AND s.training_date >= ?");
            parameters.add(Date.valueOf(ApiValues.date(from, "from")));
        }
        if (to != null) {
            where.append(" AND s.training_date <= ?");
            parameters.add(Date.valueOf(ApiValues.date(to, "to")));
        }
        if (exerciseId != null) {
            where.append(" AND EXISTS (SELECT 1 FROM session_exercises se WHERE se.session_id = s.id AND se.exercise_id = ?)");
            parameters.add(ApiValues.positiveLong(exerciseId, "exerciseId"));
        }
        Long total = jdbc.queryForObject("SELECT COUNT(*)" + where, Long.class, parameters.toArray());
        List<Long> ids = jdbc.query(
                "SELECT s.id" + where + " ORDER BY s.training_date DESC, s.created_at DESC LIMIT ? OFFSET ?",
                (row, index) -> row.getLong(1),
                append(parameters, size, (long) page * size).toArray());
        List<Map<String, Object>> content = ids.stream().map(id -> readSession(id, userId)).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", content);
        result.put("page", page);
        result.put("size", size);
        result.put("totalElements", total == null ? 0 : total);
        result.put("totalPages", total == null || total == 0 ? 0 : (int) Math.ceil((double) total / size));
        return result;
    }

    @GetMapping("/{id}")
    Map<String, Object> get(@PathVariable long id, Authentication authentication) {
        return readSession(id, userId(authentication.getName()));
    }

    @PostMapping
    @Transactional
    ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body, Authentication authentication) {
        long userId = userId(authentication.getName());
        long id = insertSession(userId, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(readSession(id, userId));
    }

    @PutMapping("/{id}")
    @Transactional
    Map<String, Object> update(@PathVariable long id, @RequestBody Map<String, Object> body, Authentication authentication) {
        long userId = userId(authentication.getName());
        ensureOwned(id, userId);
        LocalDate trainingDate = ApiValues.date(body.get("trainingDate"), "trainingDate");
        String note = ApiValues.text(body, "note", false, 1000);
        List<Map<String, Object>> exercises = validateExercises(body);
        jdbc.update("UPDATE training_sessions SET training_date = ?, note = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND user_id = ?",
                Date.valueOf(trainingDate), note, id, userId);
        deleteSessionChildren(id);
        insertExercises(id, exercises);
        return readSession(id, userId);
    }

    @DeleteMapping("/{id}")
    @Transactional
    ResponseEntity<Void> delete(@PathVariable long id, Authentication authentication) {
        long userId = userId(authentication.getName());
        ensureOwned(id, userId);
        deleteSessionChildren(id);
        jdbc.update("DELETE FROM training_sessions WHERE id = ? AND user_id = ?", id, userId);
        return ResponseEntity.noContent().build();
    }

    private long insertSession(long userId, Map<String, Object> body) {
        LocalDate trainingDate = ApiValues.date(body.get("trainingDate"), "trainingDate");
        String note = ApiValues.text(body, "note", false, 1000);
        List<Map<String, Object>> exercises = validateExercises(body);
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO training_sessions (user_id, training_date, note) VALUES (?, ?, ?)",
                    new String[] {"id"});
            statement.setLong(1, userId);
            statement.setDate(2, Date.valueOf(trainingDate));
            statement.setString(3, note);
            return statement;
        }, keys);
        Number key = keys.getKey();
        if (key == null) {
            throw new IllegalStateException("Session insert did not return an identifier");
        }
        long sessionId = key.longValue();
        insertExercises(sessionId, exercises);
        return sessionId;
    }

    private List<Map<String, Object>> validateExercises(Map<String, Object> body) {
        List<?> input = ApiValues.list(body.get("exercises"), "exercises", true);
        if (input.isEmpty() || input.size() > 100) {
            throw ApiValues.invalid("exercises");
        }
        List<Map<String, Object>> exercises = new ArrayList<>();
        int order = 1;
        for (Object value : input) {
            Map<String, Object> item = ApiValues.object(value, "exercises");
            long exerciseId = ApiValues.positiveLong(item.get("exerciseId"), "exerciseId");
            String note = ApiValues.text(item, "note", false, 500);
            int displayOrder = item.containsKey("displayOrder")
                    ? ApiValues.positiveInt(item.get("displayOrder"), "displayOrder")
                    : order;
            List<?> sets = ApiValues.list(item.get("sets"), "sets", true);
            if (sets.isEmpty() || sets.size() > 50) {
                throw ApiValues.invalid("sets");
            }
            List<Map<String, Object>> validatedSets = new ArrayList<>();
            int setNumber = 1;
            for (Object setValue : sets) {
                Map<String, Object> set = ApiValues.object(setValue, "sets");
                Object repsInput = set.get("reps");
                Object durationInput = set.get("durationSeconds");
                if ((repsInput == null) == (durationInput == null)) {
                    throw ApiValues.invalid("reps");
                }
                Integer reps = repsInput == null ? null : ApiValues.positiveInt(repsInput, "reps");
                Integer duration = durationInput == null ? null : ApiValues.positiveInt(durationInput, "durationSeconds");
                BigDecimal weight = ApiValues.decimal(set.get("weightKg"), "weightKg", BigDecimal.ZERO,
                        new BigDecimal("99999.99"));
                int number = set.containsKey("setNumber")
                        ? ApiValues.positiveInt(set.get("setNumber"), "setNumber")
                        : setNumber;
                Map<String, Object> validatedSet = new LinkedHashMap<>();
                validatedSet.put("setNumber", number);
                validatedSet.put("reps", reps);
                validatedSet.put("durationSeconds", duration);
                validatedSet.put("weightKg", weight);
                validatedSet.put("calorieEstimateId", set.get("calorieEstimateId") == null
                        ? null : ApiValues.positiveLong(set.get("calorieEstimateId"), "calorieEstimateId"));
                validatedSets.add(validatedSet);
                setNumber++;
            }
            Map<String, Object> exercise = new LinkedHashMap<>();
            exercise.put("exerciseId", exerciseId);
            exercise.put("displayOrder", displayOrder);
            exercise.put("note", note);
            exercise.put("sets", validatedSets);
            exercises.add(exercise);
            order++;
        }
        return exercises;
    }

    private void insertExercises(long sessionId, List<Map<String, Object>> exercises) {
        long ownerId = jdbc.queryForObject("SELECT user_id FROM training_sessions WHERE id = ?", Long.class, sessionId);
        for (Map<String, Object> exercise : exercises) {
            long exerciseId = (long) exercise.get("exerciseId");
            Integer visible = jdbc.queryForObject("SELECT COUNT(*) FROM exercises WHERE id = ?", Integer.class, exerciseId);
            if (visible == null || visible == 0) {
                throw ApiValues.invalid("exerciseId");
            }
            KeyHolder keys = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                var statement = connection.prepareStatement(
                        "INSERT INTO session_exercises (session_id, exercise_id, display_order, note) VALUES (?, ?, ?, ?)",
                        new String[] {"id"});
                statement.setLong(1, sessionId);
                statement.setLong(2, exerciseId);
                statement.setInt(3, (int) exercise.get("displayOrder"));
                statement.setString(4, (String) exercise.get("note"));
                return statement;
            }, keys);
            Number key = keys.getKey();
            if (key == null) {
                throw new IllegalStateException("Session exercise insert did not return an identifier");
            }
            long sessionExerciseId = key.longValue();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sets = (List<Map<String, Object>>) exercise.get("sets");
            for (Map<String, Object> set : sets) {
                Object estimateId = set.get("calorieEstimateId");
                if (estimateId != null) {
                    Integer matches = jdbc.queryForObject(
                            "SELECT COUNT(*) FROM exercise_calorie_estimates c JOIN exercises e ON e.exercise_code = c.exercise_code "
                                    + "WHERE c.id = ? AND c.user_id = ? AND e.id = ?",
                            Integer.class, estimateId, ownerId, exerciseId);
                    if (matches == null || matches == 0) {
                        throw ApiValues.invalid("calorieEstimateId");
                    }
                }
                jdbc.update("INSERT INTO set_records (session_exercise_id, set_number, reps, duration_seconds, weight_kg, calorie_estimate_id) VALUES (?, ?, ?, ?, ?, ?)",
                        sessionExerciseId, set.get("setNumber"), set.get("reps"), set.get("durationSeconds"), set.get("weightKg"), estimateId);
            }
        }
    }

    private Map<String, Object> readSession(long id, long userId) {
        Map<String, Object> session = jdbc.query(
                        "SELECT id, training_date, note, created_at, updated_at FROM training_sessions WHERE id = ? AND user_id = ?",
                        row -> {
                            if (!row.next()) {
                                return null;
                            }
                            Map<String, Object> result = new LinkedHashMap<>();
                            result.put("id", row.getLong("id"));
                            result.put("trainingDate", row.getDate("training_date").toLocalDate().toString());
                            result.put("note", row.getString("note"));
                            result.put("createdAt", row.getTimestamp("created_at").toInstant().toString());
                            result.put("updatedAt", row.getTimestamp("updated_at").toInstant().toString());
                            return result;
                        }, id, userId);
        if (session == null) {
            throw ApiValues.notFound();
        }

        List<Map<String, Object>> exercises = jdbc.query(
                "SELECT se.id, se.exercise_id, se.display_order, se.note, e.name AS exercise_name, e.category "
                        + "FROM session_exercises se JOIN exercises e ON e.id = se.exercise_id "
                        + "WHERE se.session_id = ? ORDER BY se.display_order",
                (row, index) -> {
                    Map<String, Object> exercise = new LinkedHashMap<>();
                    long sessionExerciseId = row.getLong("id");
                    exercise.put("exerciseId", row.getLong("exercise_id"));
                    exercise.put("exerciseName", row.getString("exercise_name"));
                    exercise.put("category", row.getString("category"));
                    exercise.put("displayOrder", row.getInt("display_order"));
                    exercise.put("note", row.getString("note"));
                    exercise.put("sets", jdbc.query(
                            "SELECT r.set_number, r.reps, r.duration_seconds, r.weight_kg, r.calorie_estimate_id, c.estimated_calories_kcal, c.rpe "
                                    + "FROM set_records r LEFT JOIN exercise_calorie_estimates c ON c.id = r.calorie_estimate_id "
                                    + "WHERE r.session_exercise_id = ? ORDER BY r.set_number",
                            (setRow, setIndex) -> {
                                Map<String, Object> set = new LinkedHashMap<>();
                                set.put("setNumber", setRow.getInt("set_number"));
                                set.put("reps", (Integer) setRow.getObject("reps"));
                                set.put("durationSeconds", (Integer) setRow.getObject("duration_seconds"));
                                set.put("weightKg", setRow.getBigDecimal("weight_kg"));
                                set.put("calorieEstimateId", (Long) setRow.getObject("calorie_estimate_id"));
                                set.put("estimatedCaloriesKcal", setRow.getBigDecimal("estimated_calories_kcal"));
                                set.put("rpe", (Integer) (setRow.getObject("rpe") == null ? null : setRow.getInt("rpe")));
                                return set;
                            }, sessionExerciseId));
                    return exercise;
                }, id);
        session.put("exercises", exercises);
        return session;
    }

    private void ensureOwned(long id, long userId) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM training_sessions WHERE id = ? AND user_id = ?",
                Integer.class, id, userId);
        if (count == null || count == 0) {
            throw ApiValues.notFound();
        }
    }

    private void deleteSessionChildren(long id) {
        jdbc.update("DELETE FROM set_records WHERE session_exercise_id IN (SELECT id FROM session_exercises WHERE session_id = ?)", id);
        jdbc.update("DELETE FROM session_exercises WHERE session_id = ?", id);
    }

    private long userId(String username) {
        return jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
    }

    private List<Object> append(List<Object> original, Object... values) {
        List<Object> result = new ArrayList<>(original);
        result.addAll(List.of(values));
        return result;
    }
}