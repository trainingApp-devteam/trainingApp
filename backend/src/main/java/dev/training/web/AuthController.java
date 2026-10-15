package dev.training.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.jdbc.core.JdbcTemplate;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final JdbcTemplate jdbc;

    public AuthController(AuthenticationManager authenticationManager, JdbcTemplate jdbc) {
        this.authenticationManager = authenticationManager;
        this.jdbc = jdbc;
    }

    @GetMapping("/csrf")
    ResponseEntity<Void> csrf(CsrfToken token) {
        token.getToken();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    Map<String, Object> login(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        Object username = body.get("username");
        Object password = body.get("password");
        if (!(username instanceof String user) || user.isBlank()
                || !(password instanceof String pass) || pass.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "ユーザー名とパスワードを入力してください。", "username");
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(user.trim().toLowerCase(Locale.ROOT), pass));
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            if (request.getSession(false) != null) {
                request.changeSessionId();
            }
            HttpSession session = request.getSession(true);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
            return currentAccount(authentication.getName());
        } catch (AuthenticationException exception) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED", "ユーザー名またはパスワードが正しくありません。", null);
        }
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/refresh")
    Map<String, Object> refresh(HttpServletRequest request, Authentication authentication) {
        request.changeSessionId();
        return currentAccount(authentication.getName());
    }

    @GetMapping("/me")
    Map<String, Object> me(Authentication authentication) {
        return currentAccount(authentication.getName());
    }

    private Map<String, Object> currentAccount(String username) {
        return jdbc.query(
                "SELECT id, username, display_name, role FROM users WHERE username = ? AND status = 'ACTIVE'",
                row -> {
                    if (!row.next()) {
                        throw ApiValues.notFound();
                    }
                    Map<String, Object> account = new LinkedHashMap<>();
                    account.put("id", row.getLong("id"));
                    account.put("username", row.getString("username"));
                    account.put("displayName", row.getString("display_name"));
                    account.put("role", row.getString("role"));
                    return account;
                }, username);
    }
}