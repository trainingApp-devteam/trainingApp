package dev.training.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestIdFilterTest {
    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void reusesASafeClientIdAndExposesItToLogsOnlyDuringTheRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Request-Id", "client-123.A_b");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> seenInChain = new AtomicReference<>();
        AtomicReference<String> seenByErrors = new AtomicReference<>();

        filter.doFilter(request, response, new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest req, jakarta.servlet.ServletResponse res) {
                seenInChain.set(MDC.get("requestId"));
                seenByErrors.set(RequestIdFilter.current());
            }
        });

        assertEquals("client-123.A_b", response.getHeader("X-Request-Id"));
        assertEquals("client-123.A_b", seenInChain.get());
        assertEquals("client-123.A_b", seenByErrors.get());
        assertNull(MDC.get("requestId"));
    }

    @Test
    void generatesAnIdWhenMissingOrUnsafe() throws Exception {
        for (String supplied : new String[] {null, "bad id!", "x".repeat(65), "a\"b"}) {
            MockHttpServletRequest request = new MockHttpServletRequest();
            if (supplied != null) {
                request.addHeader("X-Request-Id", supplied);
            }
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilter(request, response, new MockFilterChain());

            String id = response.getHeader("X-Request-Id");
            assertNotNull(id);
            assertNotEquals(supplied, id);
            assertEquals(36, id.length());
        }
    }

    @Test
    void currentFallsBackToARandomIdOutsideARequest() {
        assertNotNull(RequestIdFilter.current());
        assertNotEquals(RequestIdFilter.current(), RequestIdFilter.current());
    }
}