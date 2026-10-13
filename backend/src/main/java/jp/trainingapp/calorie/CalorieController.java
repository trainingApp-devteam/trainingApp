package jp.trainingapp.calorie;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class CalorieController {
    private static final BigDecimal MET_KCAL_FACTOR = new BigDecimal("3.5");
    private static final BigDecimal MET_DIVISOR = new BigDecimal("200");

    private final JdbcTemplate jdbcTemplate;

    public CalorieController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/exercises")
    public List<Map<String, Object>> listExercises(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "") String category) {
        return jdbcTemplate.queryForList("""
                SELECT exercise_code AS id, name, exercise_group AS `group`,
                       is_builtin AS isBuiltin, calorie_enabled AS calorieEnabled
                FROM exercises
                WHERE name LIKE ? AND (? = '' OR exercise_group = ?)
                ORDER BY exercise_group, name
                """, "%" + q + "%", category, category);
    }

    @GetMapping("/exercise-groups")
    public List<Map<String, Object>> listExerciseGroups() {
        return jdbcTemplate.queryForList("""
                SELECT DISTINCT exercise_group AS id, exercise_group AS name
                FROM exercises
                ORDER BY exercise_group
                """);
    }

    @GetMapping("/exercises/{code}/calorie-rates")
    public List<Map<String, Object>> listRates(@PathVariable String code) {
        return jdbcTemplate.queryForList("""
                SELECT id, basis, rpe_min AS rpeMin, rpe_max AS rpeMax,
                       met_value AS metValue, seconds_per_rep AS secondsPerRep,
                       version, source
                FROM exercise_calorie_rates
                WHERE exercise_code = ? AND enabled = TRUE
                ORDER BY basis, rpe_min
                """, code);
    }

    @PostMapping("/calorie-estimates")
    public EstimateResponse estimate(@Valid @RequestBody EstimateRequest request) {
        Rate rate = findRate(request);
        BigDecimal activeSeconds = request.basis().equals("REP")
                ? rate.secondsPerRep().multiply(BigDecimal.valueOf(request.reps()))
                : BigDecimal.valueOf(request.durationSeconds());

        BigDecimal calories = rate.metValue()
                .multiply(MET_KCAL_FACTOR)
                .multiply(request.bodyWeightKg())
                .divide(MET_DIVISOR, 8, RoundingMode.HALF_UP)
                .multiply(activeSeconds)
                .divide(BigDecimal.valueOf(60), 8, RoundingMode.HALF_UP)
                .setScale(2, RoundingMode.HALF_UP);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO exercise_calorie_estimates
                        (exercise_code, rate_id, basis, rpe, body_weight_kg,
                         external_load_kg, reps, duration_seconds, active_seconds,
                         estimated_calories_kcal)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, request.exerciseCode());
            statement.setLong(2, rate.id());
            statement.setString(3, request.basis());
            statement.setInt(4, request.rpe());
            statement.setBigDecimal(5, request.bodyWeightKg());
            statement.setBigDecimal(6, request.externalLoadKg());
            statement.setObject(7, request.reps());
            statement.setObject(8, request.durationSeconds());
            statement.setBigDecimal(9, activeSeconds);
            statement.setBigDecimal(10, calories);
            return statement;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        return new EstimateResponse(
                generatedId == null ? null : generatedId.longValue(),
                request.exerciseCode(), request.basis(), request.rpe(),
                request.bodyWeightKg(), activeSeconds, rate.metValue(), calories,
                "推定値。休憩時間は含みません。動作時間とRPEは概算です。");
    }

    private Rate findRate(EstimateRequest request) {
        if (!request.basis().equals("REP") && !request.basis().equals("MINUTE")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "basis must be REP or MINUTE");
        }
        if (request.basis().equals("REP") && (request.reps() == null || request.durationSeconds() != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "REP basis requires reps only");
        }
        if (request.basis().equals("MINUTE") && (request.durationSeconds() == null || request.reps() != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MINUTE basis requires durationSeconds only");
        }

        List<Rate> rates = jdbcTemplate.query("""
                SELECT r.id, r.met_value, r.seconds_per_rep
                FROM exercise_calorie_rates r
                JOIN exercises e ON e.exercise_code = r.exercise_code
                WHERE r.exercise_code = ? AND r.basis = ? AND r.enabled = TRUE
                  AND e.calorie_enabled = TRUE AND e.is_builtin = TRUE
                  AND ? BETWEEN r.rpe_min AND r.rpe_max
                """, (resultSet, rowNum) -> new Rate(
                resultSet.getLong("id"), resultSet.getBigDecimal("met_value"),
                resultSet.getBigDecimal("seconds_per_rep")),
                request.exerciseCode(), request.basis(), request.rpe());

        if (rates.size() != 1) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "No unique built-in calorie rate matches the exercise, basis, and RPE");
        }
        return rates.get(0);
    }

    public record EstimateRequest(
            @NotBlank String exerciseCode,
            @NotBlank String basis,
            @NotNull @Min(1) @Max(10) Integer rpe,
            @NotNull @DecimalMin("20.0") @DecimalMax("300.0") BigDecimal bodyWeightKg,
            @DecimalMin("0.0") BigDecimal externalLoadKg,
            @Min(1) @Max(500) Integer reps,
            @Min(1) @Max(86400) Integer durationSeconds) {}

    public record EstimateResponse(
            Long estimateId,
            String exerciseCode,
            String basis,
            Integer rpe,
            BigDecimal bodyWeightKg,
            BigDecimal activeSeconds,
            BigDecimal metValue,
            BigDecimal estimatedCaloriesKcal,
            String note) {}

    private record Rate(long id, BigDecimal metValue, BigDecimal secondsPerRep) {}
}