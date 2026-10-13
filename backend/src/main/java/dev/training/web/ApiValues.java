package dev.training.web;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;

final class ApiValues {
    private ApiValues() {
    }

    static String text(Map<String, Object> body, String key, boolean required, int maxLength) {
        Object value = body.get(key);
        if (value == null) {
            if (required) {
                throw invalid(key);
            }
            return null;
        }
        if (!(value instanceof String text) || (required && text.isBlank()) || text.length() > maxLength) {
            throw invalid(key);
        }
        return text.trim().isEmpty() ? null : text.trim();
    }

    static long positiveLong(Object value, String field) {
        try {
            long number = new BigDecimal(String.valueOf(value)).longValueExact();
            if (number < 1) {
                throw invalid(field);
            }
            return number;
        } catch (NumberFormatException | ArithmeticException exception) {
            throw invalid(field);
        }
    }

    static int positiveInt(Object value, String field) {
        long number = positiveLong(value, field);
        if (number > Integer.MAX_VALUE) {
            throw invalid(field);
        }
        return (int) number;
    }

    static BigDecimal decimal(Object value, String field, BigDecimal min, BigDecimal max) {
        if (value == null) {
            return null;
        }
        try {
            BigDecimal number = new BigDecimal(String.valueOf(value));
            if (number.compareTo(min) < 0 || number.compareTo(max) > 0) {
                throw invalid(field);
            }
            return number;
        } catch (NumberFormatException exception) {
            throw invalid(field);
        }
    }

    static LocalDate date(Object value, String field) {
        try {
            return LocalDate.parse(String.valueOf(value));
        } catch (DateTimeParseException exception) {
            throw invalid(field);
        }
    }

    static Instant instant(Object value, String field) {
        try {
            return Instant.parse(String.valueOf(value));
        } catch (DateTimeParseException exception) {
            throw invalid(field);
        }
    }

    static List<?> list(Object value, String field, boolean required) {
        if (value == null && !required) {
            return List.of();
        }
        if (!(value instanceof List<?> list)) {
            throw invalid(field);
        }
        return list;
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> object(Object value, String field) {
        if (!(value instanceof Map<?, ?> map)) {
            throw invalid(field);
        }
        return (Map<String, Object>) map;
    }

    static ApiException invalid(String field) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "入力内容を確認してください。", field);
    }

    static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "対象のデータが見つかりません。", null);
    }
}