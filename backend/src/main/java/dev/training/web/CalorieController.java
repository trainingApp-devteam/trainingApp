package dev.training.web;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CalorieController {
    private static final BigDecimal MET_KCAL_FACTOR = new BigDecimal("3.5");
    private static final BigDecimal MET_DIVISOR = new BigDecimal("200");
    private static final String NOTE = "推定値。休憩時間は含みません。動作時間とRPEは概算です。";

    private final JdbcTemplate jdbc;

    public CalorieController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/exercises/{id}/calorie-rates")
    List<Map<String, Object>> listRates(@PathVariable long id) {
        return jdbc.query("""
                SELECT r.id, r.basis, r.rpe_min, r.rpe_max, r.met_value, r.seconds_per_rep, r.version, r.source
                FROM exercise_calorie_rates r
                JOIN exercises e ON e.exercise_code = r.exercise_code
                WHERE e.id = ? AND e.owner_user_id IS NULL AND r.enabled = TRUE
                ORDER BY r.basis, r.rpe_min
                """, (row, index) -> {
            Map<String, Object> rate = new LinkedHashMap<>();
            rate.put("id", row.getLong("id"));
            rate.put("basis", row.getString("basis"));
            rate.put("rpeMin", row.getInt("rpe_min"));
            rate.put("rpeMax", row.getInt("rpe_max"));
            rate.put("metValue", row.getBigDecimal("met_value"));
            rate.put("secondsPerRep", row.getBigDecimal("seconds_per_rep"));
            rate.put("version", row.getInt("version"));
            rate.put("source", row.getString("source"));
            return rate;
        }, id);
    }

    @PostMapping("/calorie-estimates")
    @Transactional
    ResponseEntity<Map<String, Object>> estimate(@RequestBody Map<String, Object> body, Authentication authentication) {
        long exerciseId = ApiValues.positiveLong(body.get("exerciseId"), "exerciseId");
        String basis = ApiValues.text(body, "basis", true, 10);
        if (!"REP".equals(basis) && !"MINUTE".equals(basis)) {
            throw ApiValues.invalid("basis");
        }
        int rpe = ApiValues.positiveInt(body.get("rpe"), "rpe");
        if (rpe > 10) {
            throw ApiValues.invalid("rpe");
        }
        BigDecimal bodyWeightKg = ApiValues.decimal(body.get("bodyWeightKg"), "bodyWeightKg", new BigDecimal("20"), new BigDecimal("300"));
        if (bodyWeightKg == null) {
            throw ApiValues.invalid("bodyWeightKg");
        }
        BigDecimal externalLoadKg = ApiValues.decimal(body.get("externalLoadKg"), "externalLoadKg", BigDecimal.ZERO, new BigDecimal("1000"));
        Integer reps = body.get("reps") == null ? null : ApiValues.positiveInt(body.get("reps"), "reps");
        Integer durationSeconds = body.get("durationSeconds") == null ? null : ApiValues.positiveInt(body.get("durationSeconds"), "durationSeconds");
        if (reps != null && reps > 500) {
            throw ApiValues.invalid("reps");
        }
        if (durationSeconds != null && durationSeconds > 86400) {
            throw ApiValues.invalid("durationSeconds");
        }
        if ("REP".equals(basis) ? reps == null || durationSeconds != null : durationSeconds == null || reps != null) {
            throw ApiValues.invalid("REP".equals(basis) ? "reps" : "durationSeconds");
        }

        Rate rate = findRate(exerciseId, basis, rpe);
        BigDecimal activeSeconds = "REP".equals(basis)
                ? rate.secondsPerRep().multiply(BigDecimal.valueOf(reps))
                : BigDecimal.valueOf(durationSeconds);
        BigDecimal calories = rate.metValue()
                .multiply(MET_KCAL_FACTOR)
                .multiply(bodyWeightKg)
                .divide(MET_DIVISOR, 8, RoundingMode.HALF_UP)
                .multiply(activeSeconds)
                .divide(BigDecimal.valueOf(60), 8, RoundingMode.HALF_UP)
                .setScale(2, RoundingMode.HALF_UP);

        long userId = jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, authentication.getName());
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO exercise_calorie_estimates
                        (user_id, exercise_code, rate_id, basis, rpe, body_weight_kg,
                         external_load_kg, reps, duration_seconds, active_seconds, estimated_calories_kcal)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, new String[] {"id"});
            statement.setLong(1, userId);
            statement.setString(2, rate.exerciseCode());
            statement.setLong(3, rate.id());
            statement.setString(4, basis);
            statement.setInt(5, rpe);
            statement.setBigDecimal(6, bodyWeightKg);
            statement.setBigDecimal(7, externalLoadKg);
            statement.setObject(8, reps);
            statement.setObject(9, durationSeconds);
            statement.setBigDecimal(10, activeSeconds);
            statement.setBigDecimal(11, calories);
            return statement;
        }, keys);
        Number key = keys.getKey();
        if (key == null) {
            throw new IllegalStateException("Calorie estimate insert did not return an identifier");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("estimateId", key.longValue());
        result.put("exerciseId", exerciseId);
        result.put("exerciseCode", rate.exerciseCode());
        result.put("basis", basis);
        result.put("rpe", rpe);
        result.put("bodyWeightKg", bodyWeightKg);
        result.put("activeSeconds", activeSeconds);
        result.put("metValue", rate.metValue());
        result.put("estimatedCaloriesKcal", calories);
        result.put("note", NOTE);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    private Rate findRate(long exerciseId, String basis, int rpe) {
        List<Rate> rates = jdbc.query("""
                SELECT r.id, r.exercise_code, r.met_value, r.seconds_per_rep
                FROM exercise_calorie_rates r
                JOIN exercises e ON e.exercise_code = r.exercise_code
                WHERE e.id = ? AND e.owner_user_id IS NULL AND e.calorie_enabled = TRUE
                  AND r.basis = ? AND r.enabled = TRUE AND ? BETWEEN r.rpe_min AND r.rpe_max
                """, (row, index) -> new Rate(row.getLong("id"), row.getString("exercise_code"),
                row.getBigDecimal("met_value"), row.getBigDecimal("seconds_per_rep")),
                exerciseId, basis, rpe);
        if (rates.size() != 1) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "CALORIE_RATE_NOT_FOUND",
                    "この種目・入力方式・RPEでは消費カロリーを推定できません。", "exerciseId");
        }
        return rates.get(0);
    }

    private record Rate(long id, String exerciseCode, BigDecimal metValue, BigDecimal secondsPerRep) {}
}
