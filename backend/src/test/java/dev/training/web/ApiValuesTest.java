package dev.training.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ApiValuesTest {
    @Test
    void textTrimsAndHonoursRequiredAndLength() {
        assertEquals("abc", ApiValues.text(Map.of("name", "  abc "), "name", true, 10));
        assertNull(ApiValues.text(Map.of(), "name", false, 10));
        assertNull(ApiValues.text(Map.of("name", "   "), "name", false, 10));
        assertInvalid(() -> ApiValues.text(Map.of(), "name", true, 10), "name");
        assertInvalid(() -> ApiValues.text(Map.of("name", "   "), "name", true, 10), "name");
        assertInvalid(() -> ApiValues.text(Map.of("name", "12345678901"), "name", true, 10), "name");
        assertInvalid(() -> ApiValues.text(Map.of("name", 5), "name", true, 10), "name");
    }

    @Test
    void positiveNumbersRejectZeroFractionsAndGarbage() {
        assertEquals(1L, ApiValues.positiveLong(1, "id"));
        assertEquals(7L, ApiValues.positiveLong("7", "id"));
        assertEquals(3, ApiValues.positiveInt(3.0, "reps"));
        assertInvalid(() -> ApiValues.positiveLong(0, "id"), "id");
        assertInvalid(() -> ApiValues.positiveLong(1.5, "id"), "id");
        assertInvalid(() -> ApiValues.positiveLong("abc", "id"), "id");
        assertInvalid(() -> ApiValues.positiveInt(Long.MAX_VALUE, "reps"), "reps");
    }

    @Test
    void decimalEnforcesInclusiveBounds() {
        BigDecimal min = new BigDecimal("20");
        BigDecimal max = new BigDecimal("300");
        assertNull(ApiValues.decimal(null, "weight", min, max));
        assertEquals(new BigDecimal("20"), ApiValues.decimal(20, "weight", min, max));
        assertEquals(new BigDecimal("300"), ApiValues.decimal("300", "weight", min, max));
        assertInvalid(() -> ApiValues.decimal("19.99", "weight", min, max), "weight");
        assertInvalid(() -> ApiValues.decimal("300.01", "weight", min, max), "weight");
        assertInvalid(() -> ApiValues.decimal("x", "weight", min, max), "weight");
    }

    @Test
    void datesAndCollectionsAreValidated() {
        assertEquals(LocalDate.of(2026, 10, 13), ApiValues.date("2026-10-13", "date"));
        assertInvalid(() -> ApiValues.date("2026/10/13", "date"), "date");
        assertInvalid(() -> ApiValues.date(null, "date"), "date");
        assertEquals(List.of(), ApiValues.list(null, "items", false));
        assertInvalid(() -> ApiValues.list(null, "items", true), "items");
        assertInvalid(() -> ApiValues.list("x", "items", false), "items");
        assertInvalid(() -> ApiValues.object("x", "item"), "item");
    }

    @Test
    void errorsCarryStatusCodeAndField() {
        ApiException invalid = ApiValues.invalid("reps");
        assertEquals(HttpStatus.BAD_REQUEST, invalid.status());
        assertEquals("VALIDATION_ERROR", invalid.code());
        assertEquals("reps", invalid.field());
        ApiException missing = ApiValues.notFound();
        assertEquals(HttpStatus.NOT_FOUND, missing.status());
        assertNull(missing.field());
    }

    private static void assertInvalid(org.junit.jupiter.api.function.Executable executable, String field) {
        ApiException exception = assertThrows(ApiException.class, executable);
        assertEquals(HttpStatus.BAD_REQUEST, exception.status());
        assertEquals(field, exception.field());
    }
}