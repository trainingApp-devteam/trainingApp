package dev.training.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.math.BigDecimal;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.jdbc.core.JdbcTemplate;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public AuthController(AuthenticationManager authenticationManager, JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
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

    // 指定した項目だけを変更する。身長は一度登録したら変わらない前提だが、入力誤りの訂正は許可する
    @PatchMapping("/me")
    @Transactional
    Map<String, Object> updateMe(@RequestBody Map<String, Object> body, Authentication authentication) {
        String username = authentication.getName();
        if (body.containsKey("displayName")) {
            String displayName = ApiValues.text(body, "displayName", true, 100);
            jdbc.update("UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE username = ?",
                    displayName, username);
        }
        if (body.containsKey("heightCm")) {
            if (body.get("heightCm") == null) {
                throw ApiValues.invalid("heightCm");
            }
            BigDecimal heightCm = ApiValues.decimal(body.get("heightCm"), "heightCm", new BigDecimal("50"), new BigDecimal("300"));
            if (heightCm.scale() > 1) {
                throw ApiValues.invalid("heightCm");
            }
            jdbc.update("UPDATE users SET height_cm = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE username = ?",
                    heightCm, username);
        }
        return currentAccount(username);
    }

    @PutMapping("/me/password")
    @Transactional
    ResponseEntity<Void> changePassword(
            @RequestBody Map<String, Object> body, Authentication authentication, HttpServletRequest request) {
        Object currentInput = body.get("currentPassword");
        Object newInput = body.get("newPassword");
        if (!(currentInput instanceof String currentPassword) || currentPassword.isEmpty()) {
            throw ApiValues.invalid("currentPassword");
        }
        if (!(newInput instanceof String newPassword) || newPassword.length() < 12 || newPassword.length() > 128) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "新しいパスワードは12〜128文字で入力してください。", "newPassword");
        }
        Map<String, Object> user = jdbc.query("SELECT id, password_hash FROM users WHERE username = ?", row -> {
            if (!row.next()) {
                throw ApiValues.notFound();
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", row.getLong("id"));
            result.put("hash", row.getString("password_hash"));
            return result;
        }, authentication.getName());
        if (!passwordEncoder.matches(currentPassword, (String) user.get("hash"))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_MISMATCH", "現在のパスワードが正しくありません。", "currentPassword");
        }
        if (currentPassword.equals(newPassword)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "現在と異なるパスワードを入力してください。", "newPassword");
        }
        long userId = (long) user.get("id");
        jdbc.update("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                passwordEncoder.encode(newPassword), userId);
        jdbc.update("INSERT INTO audit_events (actor_user_id, action, target_type, target_id) VALUES (?, 'PASSWORD_CHANGED', 'USER', ?)",
                userId, userId);
        request.changeSessionId();
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> currentAccount(String username) {
        return jdbc.query(
                "SELECT id, username, display_name, role, height_cm FROM users WHERE username = ? AND status = 'ACTIVE'",
                row -> {
                    if (!row.next()) {
                        throw ApiValues.notFound();
                    }
                    Map<String, Object> account = new LinkedHashMap<>();
                    account.put("id", row.getLong("id"));
                    account.put("username", row.getString("username"));
                    account.put("displayName", row.getString("display_name"));
                    account.put("role", row.getString("role"));
                    account.put("heightCm", row.getBigDecimal("height_cm"));
                    return account;
                }, username);
    }
}