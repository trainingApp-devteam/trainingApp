package dev.training.web;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/invitations")
public class InvitationController {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    public InvitationController(
            JdbcTemplate jdbc,
            org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/accept")
    @Transactional
    ResponseEntity<Map<String, Object>> accept(@RequestBody Map<String, Object> body) {
        String token = ApiValues.text(body, "token", true, 128);
        String username = ApiValues.text(body, "username", true, 64).toLowerCase(java.util.Locale.ROOT);
        String displayName = ApiValues.text(body, "displayName", true, 100);
        Object passwordInput = body.get("password");
        if (!(passwordInput instanceof String password) || password.length() < 12 || password.length() > 128) {
            throw ApiValues.invalid("password");
        }
        if (username.length() < 3) {
            throw ApiValues.invalid("username");
        }

        Map<String, Object> invitation = jdbc.query(
                        "SELECT id, created_by_user_id, expires_at, accepted_at, revoked_at FROM invitations "
                                + "WHERE token_hash = ? FOR UPDATE",
                        row -> {
                            if (!row.next()) {
                                return null;
                            }
                            Map<String, Object> result = new LinkedHashMap<>();
                            result.put("id", row.getLong("id"));
                            result.put("createdBy", row.getLong("created_by_user_id"));
                            result.put("expiresAt", row.getTimestamp("expires_at").toInstant());
                            result.put("acceptedAt", row.getTimestamp("accepted_at"));
                            result.put("revokedAt", row.getTimestamp("revoked_at"));
                            return result;
                        }, hashToken(token));
        if (invitation == null
                || invitation.get("acceptedAt") != null
                || invitation.get("revokedAt") != null
                || !((Instant) invitation.get("expiresAt")).isAfter(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVITATION_INVALID", "招待トークンが無効または期限切れです。", null);
        }

        Integer existing = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE username = ?", Integer.class, username);
        if (existing != null && existing > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "このユーザー名は使用できません。", "username");
        }
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO users (username, display_name, password_hash, role, status) VALUES (?, ?, ?, 'USER', 'PENDING_APPROVAL')",
                    new String[] {"id"});
            statement.setString(1, username);
            statement.setString(2, displayName);
            statement.setString(3, passwordEncoder.encode(password));
            return statement;
        }, keys);
        Number userKey = keys.getKey();
        if (userKey == null) {
            throw new IllegalStateException("User insert did not return an identifier");
        }
        long invitationId = (long) invitation.get("id");
        jdbc.update("UPDATE invitations SET requested_user_id = ?, accepted_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                userKey.longValue(), invitationId);
        jdbc.update("INSERT INTO audit_events (actor_user_id, action, target_type, target_id) VALUES (?, 'INVITATION_ACCEPTED', 'INVITATION', ?)",
                userKey.longValue(), invitationId);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("status", "PENDING_APPROVAL"));
    }

    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}