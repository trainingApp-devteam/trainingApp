package dev.training.web;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// 本人の記録だけを集計する。同じ日に複数の記録がある場合も、記録（セッション）ごとに1点とする
@RestController
@RequestMapping("/api/v1/statistics/exercises")
public class StatisticsController {
    private final JdbcTemplate jdbc;

    public StatisticsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // 記録したことのある種目と、その記録回数・最終実施日
    @GetMapping
    List<Map<String, Object>> recordedExercises(Authentication authentication) {
        return jdbc.query("""
                SELECT e.id, e.name, e.category, COUNT(DISTINCT s.id) AS session_count, MAX(s.training_date) AS last_date
                FROM training_sessions s
                JOIN session_exercises se ON se.session_id = s.id
                JOIN exercises e ON e.id = se.exercise_id
                WHERE s.user_id = ?
                GROUP BY e.id, e.name, e.category
                ORDER BY last_date DESC, e.name
                """, (row, index) -> {
            Map<String, Object> exercise = new LinkedHashMap<>();
            exercise.put("exerciseId", row.getLong("id"));
            exercise.put("exerciseName", row.getString("name"));
            exercise.put("category", row.getString("category"));
            exercise.put("sessionCount", row.getInt("session_count"));
            exercise.put("lastTrainingDate", row.getDate("last_date").toLocalDate().toString());
            return exercise;
        }, userId(authentication.getName()));
    }

    @GetMapping("/{exerciseId}")
    Map<String, Object> exerciseProgress(
            @PathVariable long exerciseId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            Authentication authentication) {
        Map<String, Object> exercise = jdbc.query("SELECT id, name, category FROM exercises WHERE id = ?", row -> {
            if (!row.next()) {
                return null;
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("exerciseId", row.getLong("id"));
            result.put("exerciseName", row.getString("name"));
            result.put("category", row.getString("category"));
            return result;
        }, exerciseId);
        if (exercise == null) {
            throw ApiValues.notFound();
        }
        LocalDate fromDate = from == null ? null : ApiValues.date(from, "from");
        LocalDate toDate = to == null ? null : ApiValues.date(to, "to");
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw ApiValues.invalid("from");
        }

        StringBuilder sql = new StringBuilder("""
                SELECT s.id, s.training_date, s.created_at,
                       MAX(r.weight_kg) AS max_weight,
                       SUM(CASE WHEN r.reps IS NOT NULL AND r.weight_kg IS NOT NULL THEN r.weight_kg * r.reps ELSE 0 END) AS volume,
                       SUM(CASE WHEN r.reps IS NOT NULL AND r.weight_kg IS NOT NULL THEN 1 ELSE 0 END) AS volume_sets,
                       SUM(COALESCE(r.reps, 0)) AS total_reps,
                       SUM(COALESCE(r.duration_seconds, 0)) AS total_seconds,
                       COUNT(r.id) AS set_count,
                       SUM(c.estimated_calories_kcal) AS kcal
                FROM training_sessions s
                JOIN session_exercises se ON se.session_id = s.id
                JOIN set_records r ON r.session_exercise_id = se.id
                LEFT JOIN exercise_calorie_estimates c ON c.id = r.calorie_estimate_id
                WHERE s.user_id = ? AND se.exercise_id = ?
                """);
        List<Object> parameters = new ArrayList<>(List.of(userId(authentication.getName()), exerciseId));
        if (fromDate != null) {
            sql.append(" AND s.training_date >= ?");
            parameters.add(Date.valueOf(fromDate));
        }
        if (toDate != null) {
            sql.append(" AND s.training_date <= ?");
            parameters.add(Date.valueOf(toDate));
        }
        sql.append(" GROUP BY s.id, s.training_date, s.created_at ORDER BY s.training_date, s.created_at");

        List<Map<String, Object>> points = jdbc.query(sql.toString(), (row, index) -> {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("sessionId", row.getLong("id"));
            point.put("trainingDate", row.getDate("training_date").toLocalDate().toString());
            // 重量を入力したセットがない場合は最大重量なし。回数と重量が両方あるセットがない場合はトレーニング量なし
            point.put("maxWeightKg", row.getBigDecimal("max_weight"));
            point.put("volumeKg", row.getInt("volume_sets") == 0 ? null : scale(row.getBigDecimal("volume")));
            point.put("totalReps", row.getInt("total_reps"));
            point.put("totalDurationSeconds", row.getInt("total_seconds"));
            point.put("setCount", row.getInt("set_count"));
            point.put("estimatedCaloriesKcal", row.getBigDecimal("kcal"));
            return point;
        }, parameters.toArray());

        Map<String, Object> result = new LinkedHashMap<>(exercise);
        result.put("from", fromDate == null ? null : fromDate.toString());
        result.put("to", toDate == null ? null : toDate.toString());
        result.put("points", points);
        return result;
    }

    private static BigDecimal scale(BigDecimal value) {
        return value == null ? null : value.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private long userId(String username) {
        return jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
    }
}
