package dev.training.web;

import java.math.BigDecimal;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
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
@RequestMapping("/api/v1/body-measurements")
public class BodyMeasurementController {
    private final JdbcTemplate jdbc;

    public BodyMeasurementController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    Map<String, Object> list(
            @RequestParam(required = false) String measurementTypeCode,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        if (page < 0 || size < 1 || size > 100) {
            throw ApiValues.invalid("page");
        }
        long userId = userId(authentication.getName());
        StringBuilder where = new StringBuilder(" FROM body_measurements bm JOIN measurement_types mt ON mt.id = bm.measurement_type_id WHERE bm.user_id = ?");
        List<Object> parameters = new ArrayList<>();
        parameters.add(userId);
        if (measurementTypeCode != null && !measurementTypeCode.isBlank()) {
            where.append(" AND mt.code = ?");
            parameters.add(measurementTypeCode);
        }
        if (from != null) {
            where.append(" AND bm.measured_at >= ?");
            parameters.add(Timestamp.from(ApiValues.instant(from, "from")));
        }
        if (to != null) {
            where.append(" AND bm.measured_at <= ?");
            parameters.add(Timestamp.from(ApiValues.instant(to, "to")));
        }
        Long total = jdbc.queryForObject("SELECT COUNT(*)" + where, Long.class, parameters.toArray());
        List<Map<String, Object>> content = jdbc.query(
                "SELECT bm.id, mt.code, mt.name, mt.unit, bm.measured_at, bm.measurement_value" + where
                        + " ORDER BY bm.measured_at DESC, bm.id DESC LIMIT ? OFFSET ?",
                (row, index) -> measurement(row.getLong("id"), row.getString("code"), row.getString("name"),
                        row.getString("unit"), row.getTimestamp("measured_at").toInstant(), row.getBigDecimal("measurement_value")),
                append(parameters, size, (long) page * size).toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", content);
        result.put("page", page);
        result.put("size", size);
        result.put("totalElements", total == null ? 0 : total);
        result.put("totalPages", total == null || total == 0 ? 0 : (int) Math.ceil((double) total / size));
        return result;
    }

    @PostMapping
    @Transactional
    ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body, Authentication authentication) {
        long id = persist(null, userId(authentication.getName()), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(readOwned(id, userId(authentication.getName())));
    }

    @PutMapping("/{id}")
    @Transactional
    Map<String, Object> update(@PathVariable long id, @RequestBody Map<String, Object> body, Authentication authentication) {
        long userId = userId(authentication.getName());
        if (persist(id, userId, body) == 0) {
            throw ApiValues.notFound();
        }
        return readOwned(id, userId);
    }

    @DeleteMapping("/{id}")
    @Transactional
    ResponseEntity<Void> delete(@PathVariable long id, Authentication authentication) {
        int count = jdbc.update("DELETE FROM body_measurements WHERE id = ? AND user_id = ?", id, userId(authentication.getName()));
        if (count == 0) {
            throw ApiValues.notFound();
        }
        return ResponseEntity.noContent().build();
    }

    private long persist(Long id, long userId, Map<String, Object> body) {
        String code = ApiValues.text(body, "measurementTypeCode", true, 40);
        Instant measuredAt = ApiValues.instant(body.get("measuredAt"), "measuredAt");
        if (body.get("value") == null) {
            throw ApiValues.invalid("value");
        }
        BigDecimal value = ApiValues.decimal(body.get("value"), "value", BigDecimal.ZERO, new BigDecimal("9999999.999"));
        Map<String, Object> type = jdbc.query(
                        "SELECT id, min_value, max_value FROM measurement_types WHERE code = ? AND enabled = TRUE",
                        row -> {
                            if (!row.next()) {
                                return null;
                            }
                            Map<String, Object> result = new LinkedHashMap<>();
                            result.put("id", row.getLong("id"));
                            result.put("min", row.getBigDecimal("min_value"));
                            result.put("max", row.getBigDecimal("max_value"));
                            return result;
                        }, code)
                ;
        if (type == null) {
            throw ApiValues.invalid("measurementTypeCode");
        }
        BigDecimal min = (BigDecimal) type.get("min");
        BigDecimal max = (BigDecimal) type.get("max");
        if ((min != null && value.compareTo(min) < 0) || (max != null && value.compareTo(max) > 0)) {
            throw ApiValues.invalid("value");
        }
        long typeId = (long) type.get("id");
        Timestamp timestamp = Timestamp.from(measuredAt);
        if (id == null) {
            KeyHolder keys = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                var statement = connection.prepareStatement(
                        "INSERT INTO body_measurements (user_id, measurement_type_id, measured_at, measurement_value) VALUES (?, ?, ?, ?)",
                        new String[] {"id"});
                statement.setLong(1, userId);
                statement.setLong(2, typeId);
                statement.setTimestamp(3, timestamp);
                statement.setBigDecimal(4, value);
                return statement;
            }, keys);
            Number key = keys.getKey();
            if (key == null) {
                throw new IllegalStateException("Measurement insert did not return an identifier");
            }
            return key.longValue();
        }
        int count = jdbc.update("UPDATE body_measurements SET measurement_type_id = ?, measured_at = ?, measurement_value = ? WHERE id = ? AND user_id = ?",
                typeId, timestamp, value, id, userId);
        return count == 0 ? 0 : id;
    }

    private Map<String, Object> readOwned(long id, long userId) {
        Map<String, Object> result = jdbc.query(
                        "SELECT bm.id, mt.code, mt.name, mt.unit, bm.measured_at, bm.measurement_value FROM body_measurements bm "
                                + "JOIN measurement_types mt ON mt.id = bm.measurement_type_id WHERE bm.id = ? AND bm.user_id = ?",
                        row -> {
                            if (!row.next()) {
                                return null;
                            }
                            return measurement(row.getLong("id"), row.getString("code"), row.getString("name"),
                                    row.getString("unit"), row.getTimestamp("measured_at").toInstant(), row.getBigDecimal("measurement_value"));
                        }, id, userId)
                ;
        if (result == null) {
            throw ApiValues.notFound();
        }
        return result;
    }

    private Map<String, Object> measurement(long id, String code, String name, String unit, Instant measuredAt, BigDecimal value) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("measurementTypeCode", code);
        result.put("name", name);
        result.put("unit", unit);
        result.put("measuredAt", measuredAt.toString());
        result.put("value", value);
        return result;
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