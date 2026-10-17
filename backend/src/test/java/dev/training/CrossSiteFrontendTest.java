package dev.training;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

// 画面（GitHub Pages）とAPI（Render）を別ドメインで配信する構成
@SpringBootTest(properties = {
        "trainingapp.cors.allowed-origins=https://owner.github.io",
        "server.servlet.session.cookie.same-site=none",
        "server.servlet.session.cookie.secure=true",
})
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Transactional
class CrossSiteFrontendTest {
    private static final String ORIGIN = "https://owner.github.io";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void allowsTheConfiguredFrontendOriginWithCredentials() throws Exception {
        mockMvc.perform(options("/api/v1/auth/login")
                        .header("Origin", ORIGIN)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type,x-xsrf-token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", ORIGIN))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));

        mockMvc.perform(options("/api/v1/auth/login")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    void logsInWithTheCsrfTokenFromTheResponseHeaderAndSameSiteNoneCookies() throws Exception {
        String username = "cross" + UUID.randomUUID().toString().replace("-", "");
        jdbc.update("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'USER', 'ACTIVE')",
                username, passwordEncoder.encode("test-password-123"));

        MvcResult csrf = mockMvc.perform(get("/api/v1/auth/csrf").header("Origin", ORIGIN))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Access-Control-Expose-Headers", containsString("X-XSRF-TOKEN")))
                .andReturn();
        String token = csrf.getResponse().getHeader("X-XSRF-TOKEN");
        Cookie csrfCookie = csrf.getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(token);
        assertNotNull(csrfCookie);
        // 別サイトからのリクエストでも送られるよう SameSite=None; Secure にする
        assertEquals("none", csrfCookie.getAttribute("SameSite"));
        assertTrue(csrfCookie.getSecure());

        // 画面はクッキーを読めないので、ヘッダーで受け取ったトークンを送る（クッキー自体はブラウザーが自動で送る）
        mockMvc.perform(post("/api/v1/auth/login")
                        .header("Origin", ORIGIN)
                        .header("X-XSRF-TOKEN", token)
                        .cookie(csrfCookie)
                        .contentType("application/json")
                        .content("{\"username\":\"" + username + "\",\"password\":\"test-password-123\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", ORIGIN));

        // トークンがなければ拒否する
        mockMvc.perform(post("/api/v1/auth/login")
                        .header("Origin", ORIGIN)
                        .cookie(csrfCookie)
                        .contentType("application/json")
                        .content("{\"username\":\"" + username + "\",\"password\":\"test-password-123\"}"))
                .andExpect(status().isForbidden());
    }
}
