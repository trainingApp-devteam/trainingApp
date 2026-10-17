package dev.training.web;

import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    private final JdbcTemplate jdbc;

    public AdminController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping("/invitations")
    @Transactional
    ResponseEntity<Map<String, Object>> createInvitation(
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication) {
        long adminId = requireAdmin(authentication);
        int days = 7;
        if (body != null && body.containsKey("expiresInDays")) {
            days = ApiValues.positiveInt(body.get("expiresInDays"), "expiresInDays");
        }
        if (days > 30) {
            throw ApiValues.invalid("expiresInDays");
        }

        String token = InvitationController.newToken();
        Instant expiresAt = Instant.now().plus(days, ChronoUnit.DAYS);
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                    "INSERT INTO invitations (token_hash, created_by_user_id, expires_at) VALUES (?, ?, ?)",
                    new String[] {"id"});
            statement.setString(1, InvitationController.hashToken(token));
            statement.setLong(2, adminId);
            statement.setTimestamp(3, Timestamp.from(expiresAt));
            return statement;
        }, keys);
        Number key = keys.getKey();
        if (key == null) {
            throw new IllegalStateException("Invitation insert did not return an identifier");
        }
        long invitationId = key.longValue();
        audit(adminId, "INVITATION_CREATED", "INVITATION", invitationId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", invitationId);
        response.put("token", token);
        response.put("expiresAt", expiresAt.toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/users/pending")
    List<Map<String, Object>> pendingUsers(Authentication authentication) {
        requireAdmin(authentication);
        return jdbc.query(
                "SELECT id, username, display_name, created_at FROM users WHERE status = 'PENDING_APPROVAL' ORDER BY created_at, id",
                (row, index) -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("id", row.getLong("id"));
                    result.put("username", row.getString("username"));
                    result.put("displayName", row.getString("display_name"));
                    result.put("createdAt", row.getTimestamp("created_at").toInstant().toString());
                    return result;
                });
    }

    @PostMapping("/users/{id}/activate")
    @Transactional
    Map<String, Object> activate(@PathVariable long id, Authentication authentication) {
        long adminId = requireAdmin(authentication);
        int changed = jdbc.update("UPDATE users SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND status = 'PENDING_APPROVAL'", id);
        if (changed == 0) {
            throw ApiValues.notFound();
        }
        audit(adminId, "USER_ACTIVATED", "USER", id);
        return userStatus(id);
    }

    @PostMapping("/users/{id}/reject")
    @Transactional
    Map<String, Object> reject(@PathVariable long id, Authentication authentication) {
        long adminId = requireAdmin(authentication);
        int changed = jdbc.update("UPDATE users SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND status = 'PENDING_APPROVAL'", id);
        if (changed == 0) {
            throw ApiValues.notFound();
        }
        audit(adminId, "USER_REJECTED", "USER", id);
        return userStatus(id);
    }

    @PostMapping("/invitations/{id}/revoke")
    @Transactional
    ResponseEntity<Void> revokeInvitation(@PathVariable long id, Authentication authentication) {
        long adminId = requireAdmin(authentication);
        int changed = jdbc.update(
                "UPDATE invitations SET revoked_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND created_by_user_id = ? "
                        + "AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP(6)",
                id, adminId);
        if (changed == 0) {
            throw ApiValues.notFound();
        }
        audit(adminId, "INVITATION_REVOKED", "INVITATION", id);
        return ResponseEntity.noContent().build();
    }

    private long requireAdmin(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities().stream()
                .noneMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "この操作を実行できません。", null);
        }
        return jdbc.queryForObject("SELECT id FROM users WHERE username = ? AND status = 'ACTIVE'", Long.class, authentication.getName());
    }

    private Map<String, Object> userStatus(long id) {
        return jdbc.query(
                        "SELECT id, username, display_name, status FROM users WHERE id = ?",
                        row -> {
                            if (!row.next()) {
                                return null;
                            }
                            Map<String, Object> result = new LinkedHashMap<>();
                            result.put("id", row.getLong("id"));
                            result.put("username", row.getString("username"));
                            result.put("displayName", row.getString("display_name"));
                            result.put("status", row.getString("status"));
                            return result;
                        }, id)
                ;
    }

    private void audit(long actorId, String action, String targetType, long targetId) {
        jdbc.update("INSERT INTO audit_events (actor_user_id, action, target_type, target_id) VALUES (?, ?, ?, ?)",
                actorId, action, targetType, targetId);
    }
}