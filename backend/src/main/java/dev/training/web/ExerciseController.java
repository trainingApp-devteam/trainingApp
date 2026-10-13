package dev.training.web;

import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
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
@RequestMapping("/api/v1/exercises")
public class ExerciseController {
    private final JdbcTemplate jdbc;

    public ExerciseController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
        List<Map<String, Object>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            Authentication authentication) {
        String term = q == null ? "" : q.trim();
        String requestedCategory = category == null || category.isBlank() ? null : category.trim();
        if (term.length() > 100 || (requestedCategory != null && requestedCategory.length() > 50)) {
            throw ApiValues.invalid("q");
        }
        String pattern = "%" + term + "%";
        return jdbc.query(
                "SELECT id, owner_user_id, name, category, description, calorie_enabled FROM exercises "
                        + "WHERE (owner_user_id IS NULL OR owner_user_id = (SELECT id FROM users WHERE username = ?)) "
                + "AND name LIKE ? AND (? IS NULL OR category = ?) ORDER BY name, id",
                (row, index) -> exercise(row.getLong("id"), row.getObject("owner_user_id") == null,
                        row.getString("name"), row.getString("category"), row.getString("description"), row.getBoolean("calorie_enabled")),
            authentication.getName(), pattern, requestedCategory, requestedCategory);
    }

    @GetMapping("/{id}")
    Map<String, Object> get(@PathVariable long id, Authentication authentication) {
        return findVisible(id, authentication.getName());
    }

    @PostMapping
    @Transactional
    ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body, Authentication authentication) {
        String name = ApiValues.text(body, "name", true, 100);
        String category = ApiValues.text(body, "category", false, 50);
        if (category == null) {
            category = ApiValues.text(body, "group", false, 50);
        }
        String description = ApiValues.text(body, "description", false, 500);
        long ownerId = userId(authentication.getName());
        long id = insertExercise(ownerId, name, category, description);
        return ResponseEntity.status(HttpStatus.CREATED).body(findVisible(id, authentication.getName()));
    }

    @PutMapping("/{id}")
    @Transactional
    Map<String, Object> update(@PathVariable long id, @RequestBody Map<String, Object> body, Authentication authentication) {
        long ownerId = userId(authentication.getName());
        String name = ApiValues.text(body, "name", true, 100);
        String category = ApiValues.text(body, "category", false, 50);
        String description = ApiValues.text(body, "description", false, 500);
        int changed = jdbc.update(
                "UPDATE exercises SET name = ?, category = ?, description = ? WHERE id = ? AND owner_user_id = ?",
                name, category, description, id, ownerId);
        if (changed == 0) {
            throw ApiValues.notFound();
        }
        return findVisible(id, authentication.getName());
    }

    @DeleteMapping("/{id}")
    @Transactional
    org.springframework.http.ResponseEntity<Void> delete(@PathVariable long id, Authentication authentication) {
        long ownerId = userId(authentication.getName());
        int deleted = jdbc.update("DELETE FROM exercises WHERE id = ? AND owner_user_id = ?", id, ownerId);
        if (deleted == 0) {
            throw ApiValues.notFound();
        }
        return org.springframework.http.ResponseEntity.noContent().build();
    }

    private Map<String, Object> findVisible(long id, String username) {
        return jdbc.query(
                        "SELECT id, owner_user_id, name, category, description, calorie_enabled FROM exercises "
                                + "WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id = (SELECT id FROM users WHERE username = ?))",
                        (row, index) -> exercise(row.getLong("id"), row.getObject("owner_user_id") == null,
                                row.getString("name"), row.getString("category"), row.getString("description"), row.getBoolean("calorie_enabled")),
                        id, username)
                .stream()
                .findFirst()
                .orElseThrow(ApiValues::notFound);
    }

    private Map<String, Object> exercise(long id, boolean shared, String name, String category, String description, boolean calorieEnabled) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("shared", shared);
        result.put("name", name);
        result.put("category", category);
        result.put("description", description);
        result.put("calorieEnabled", shared && calorieEnabled);
        return result;
    }

    private long userId(String username) {
        return jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
    }

    private long insertExercise(long ownerId, String name, String category, String description) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO exercises (owner_user_id, name, category, description) VALUES (?, ?, ?, ?)",
                    new String[] {"id"});
            statement.setLong(1, ownerId);
            statement.setString(2, name);
            statement.setString(3, category);
            statement.setString(4, description);
            return statement;
        }, keys);
        Number key = keys.getKey();
        if (key == null) {
            throw new IllegalStateException("Exercise insert did not return an identifier");
        }
        return key.longValue();
    }
}