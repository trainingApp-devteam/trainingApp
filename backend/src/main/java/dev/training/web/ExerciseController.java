package dev.training.web;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// 種目は全利用者共通の標準種目だけ（Flywayで登録）。利用者による作成・変更・削除は提供しない
@RestController
@RequestMapping("/api/v1/exercises")
public class ExerciseController {
    // 推定できる記録形式（回数=REP / 時間=MINUTE）。画面はこれを見て、推定できない形式を選ばせない
    private static final String CALORIE_BASES =
            "EXISTS (SELECT 1 FROM exercise_calorie_rates r WHERE r.exercise_code = e.exercise_code AND r.basis = 'REP' AND r.enabled = TRUE) AS rep_rate, "
            + "EXISTS (SELECT 1 FROM exercise_calorie_rates r WHERE r.exercise_code = e.exercise_code AND r.basis = 'MINUTE' AND r.enabled = TRUE) AS minute_rate";
    private static final String SELECT = "SELECT id, name, category, description, calorie_enabled, record_type, " + CALORIE_BASES + " FROM exercises e ";

    private final JdbcTemplate jdbc;

    public ExerciseController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    List<Map<String, Object>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category) {
        String term = q == null ? "" : q.trim();
        String requestedCategory = category == null || category.isBlank() ? null : category.trim();
        if (term.length() > 100 || (requestedCategory != null && requestedCategory.length() > 50)) {
            throw ApiValues.invalid("q");
        }
        return jdbc.query(
                SELECT + "WHERE name LIKE ? AND (? IS NULL OR category = ?) ORDER BY name, id",
                (row, index) -> exercise(row),
                "%" + term + "%", requestedCategory, requestedCategory);
    }

    @GetMapping("/{id}")
    Map<String, Object> get(@PathVariable long id) {
        return jdbc.query(SELECT + "WHERE id = ?", (row, index) -> exercise(row), id)
                .stream()
                .findFirst()
                .orElseThrow(ApiValues::notFound);
    }

    private Map<String, Object> exercise(ResultSet row) throws SQLException {
        boolean calorieEnabled = row.getBoolean("calorie_enabled");
        List<String> calorieBases = new ArrayList<>();
        if (calorieEnabled && row.getBoolean("rep_rate")) {
            calorieBases.add("REP");
        }
        if (calorieEnabled && row.getBoolean("minute_rate")) {
            calorieBases.add("MINUTE");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.getLong("id"));
        result.put("name", row.getString("name"));
        result.put("category", row.getString("category"));
        result.put("description", row.getString("description"));
        result.put("calorieEnabled", calorieEnabled);
        result.put("calorieBases", calorieBases);
        // 記録形式（REP=回数 / MINUTE=時間）。種目ごとに固定
        result.put("recordType", row.getString("record_type"));
        return result;
    }
}
