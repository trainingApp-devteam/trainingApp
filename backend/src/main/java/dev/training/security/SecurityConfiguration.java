package dev.training.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.training.web.ApiError;
import dev.training.web.RequestIdFilter;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.function.Supplier;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
public class SecurityConfiguration {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(JdbcTemplate jdbc) {
        return username -> jdbc.query(
                        "SELECT username, password_hash, role, status FROM users WHERE username = ?",
                        (result, row) -> User.withUsername(result.getString("username"))
                                .password(result.getString("password_hash"))
                                .roles(result.getString("role"))
                                .disabled(!"ACTIVE".equals(result.getString("status")))
                                .build(),
                        username.trim().toLowerCase(Locale.ROOT))
                .stream()
                .findFirst()
                .orElseThrow(() -> new UsernameNotFoundException("Account not found"));
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    // 画面（例: GitHub Pages）とAPI（例: Render）を別ドメインで配信するときだけ設定する。
    // 例: TRAININGAPP_CORS_ALLOWED_ORIGINS=https://<owner>.github.io 、SESSION_COOKIE_SAME_SITE=none
    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${trainingapp.cors.allowed-origins:}") String allowedOrigins) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        List<String> origins = Arrays.stream(allowedOrigins.split(",")).map(String::trim).filter(StringUtils::hasText).toList();
        if (!origins.isEmpty()) {
            CorsConfiguration cors = new CorsConfiguration();
            cors.setAllowedOrigins(origins);
            cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            cors.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
            // 別ドメインの画面はCSRFクッキーを読めないため、トークンをレスポンスヘッダーで渡す
            cors.setExposedHeaders(List.of("X-XSRF-TOKEN"));
            cors.setAllowCredentials(true);
            source.registerCorsConfiguration("/api/**", cors);
        }
        return source;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper objectMapper,
            @Value("${server.servlet.session.cookie.same-site:lax}") String sameSite,
            @Value("${server.servlet.session.cookie.secure:true}") boolean secure) throws Exception {
        CookieCsrfTokenRepository csrfRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepository.setCookiePath("/");
        // セッションクッキーと同じ属性にする（別ドメイン構成では SameSite=None; Secure）
        csrfRepository.setCookieCustomizer(cookie -> cookie.sameSite(sameSite).secure(secure));

        http.cors(cors -> {})
                .csrf(csrf -> csrf
                .csrfTokenRepository(csrfRepository)
                .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler()))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/login", "/api/v1/invitations/accept", "/actuator/health/**", "/error")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> {
                            response.setStatus(HttpStatus.UNAUTHORIZED.value());
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(response.getOutputStream(), new ApiError(
                                    "UNAUTHENTICATED", "ログインしてください。", List.of(), RequestIdFilter.current()));
                        })
                        .accessDeniedHandler((request, response, exception) -> {
                            response.setStatus(HttpStatus.FORBIDDEN.value());
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(response.getOutputStream(), new ApiError(
                                    "FORBIDDEN", "この操作を実行できません。", List.of(), RequestIdFilter.current()));
                        }));
        return http.build();
    }

    private static final class SpaCsrfTokenRequestHandler implements CsrfTokenRequestHandler {
        private final CsrfTokenRequestHandler plain = new CsrfTokenRequestAttributeHandler();
        private final CsrfTokenRequestHandler xor = new XorCsrfTokenRequestAttributeHandler();

        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response, Supplier<CsrfToken> deferredToken) {
            xor.handle(request, response, deferredToken);
            deferredToken.get();
        }

        // ヘッダーの値は、/auth/csrf のレスポンスヘッダーで渡したマスク済みトークン（別ドメイン構成）か、
        // クッキーから読んだ生のトークン（同一ドメイン構成）のどちらか。マスク済みとして解けなければ生の値として扱う
        @Override
        public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
            String headerValue = request.getHeader(csrfToken.getHeaderName());
            if (!StringUtils.hasText(headerValue)) {
                return xor.resolveCsrfTokenValue(request, csrfToken);
            }
            String masked = xor.resolveCsrfTokenValue(request, csrfToken);
            return masked != null ? masked : plain.resolveCsrfTokenValue(request, csrfToken);
        }
    }
}