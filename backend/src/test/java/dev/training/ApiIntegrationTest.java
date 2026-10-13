package dev.training;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Transactional
class ApiIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    private String owner;
    private String other;
    private String admin;

    @BeforeEach
    void createUsers() {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        owner = "owner" + suffix;
        other = "other" + suffix;
        admin = "admin" + suffix;
        String hash = passwordEncoder.encode("test-password-123");
        jdbc.update("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'USER', 'ACTIVE')", owner, hash);
        jdbc.update("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'USER', 'ACTIVE')", other, hash);
        jdbc.update("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'ADMIN', 'ACTIVE')", admin, hash);
    }

    @Test
    void protectsResourcesAndReturnsStandardUnauthorizedError() throws Exception {
        mockMvc.perform(get("/api/v1/training-sessions"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

            @Test
            void rotatesAndInvalidatesSessionWithCsrfProtection() throws Exception {
                MockHttpSession preAuthenticationSession = new MockHttpSession();
                String preAuthenticationSessionId = preAuthenticationSession.getId();
                MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .session(preAuthenticationSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                            java.util.Map.of("username", owner, "password", "test-password-123"))))
                    .andExpect(status().isOk())
                    .andReturn();
                MockHttpSession session = (MockHttpSession) loginResult.getRequest().getSession(false);
                assertNotEquals(preAuthenticationSessionId, session.getId());
            String oldSessionId = session.getId();

            MvcResult refreshResult = mockMvc.perform(post("/api/v1/auth/refresh").session(session).with(csrf()))
                .andExpect(status().isOk())
                .andReturn();
            MockHttpSession refreshedSession = (MockHttpSession) refreshResult.getRequest().getSession(false);
            assertNotEquals(oldSessionId, refreshedSession.getId());

            mockMvc.perform(post("/api/v1/auth/logout").session(refreshedSession))
                .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/v1/auth/logout").session(refreshedSession).with(csrf()))
                .andExpect(status().isNoContent());
            mockMvc.perform(get("/api/v1/auth/me").session(refreshedSession))
                .andExpect(status().isUnauthorized());
            }

            @Test
            void invitationRequiresAdminApprovalAndRevokedTokensCannotBeUsed() throws Exception {
            MockHttpSession adminSession = login(admin);
            MockHttpSession userSession = login(owner);
            mockMvc.perform(post("/api/v1/admin/invitations")
                    .session(userSession)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                .andExpect(status().isForbidden());

            MvcResult invitationResult = mockMvc.perform(post("/api/v1/admin/invitations")
                    .session(adminSession)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();
            JsonNode invitation = objectMapper.readTree(invitationResult.getResponse().getContentAsString());
            String token = invitation.path("token").asText();
            String invitedUsername = "invited" + UUID.randomUUID().toString().replace("-", "");
            String invitedPassword = "different-secret-pass-456";

            mockMvc.perform(post("/api/v1/invitations/accept")
                    .with(csrf())
                    .contentType("application/json")
                    .content(objectMapper.writeValueAsString(java.util.Map.of(
                        "token", token,
                        "username", invitedUsername,
                        "displayName", "Invited User",
                        "password", invitedPassword))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING_APPROVAL"));
            mockMvc.perform(post("/api/v1/auth/login")
                    .with(csrf())
                    .contentType("application/json")
                    .content(objectMapper.writeValueAsString(java.util.Map.of(
                        "username", invitedUsername, "password", invitedPassword))))
                .andExpect(status().isUnauthorized());

            MvcResult pendingResult = mockMvc.perform(get("/api/v1/admin/users/pending").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value(invitedUsername))
                .andReturn();
            long invitedUserId = objectMapper.readTree(pendingResult.getResponse().getContentAsString()).get(0).path("id").asLong();
            mockMvc.perform(post("/api/v1/admin/users/{id}/activate", invitedUserId).session(adminSession).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
            mockMvc.perform(post("/api/v1/auth/login")
                    .with(csrf())
                    .contentType("application/json")
                    .content(objectMapper.writeValueAsString(java.util.Map.of(
                        "username", invitedUsername, "password", invitedPassword))))
                .andExpect(status().isOk());

            MvcResult rejectionInvitationResult = mockMvc.perform(post("/api/v1/admin/invitations")
                    .session(adminSession)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();
            String rejectionUsername = "rejected" + UUID.randomUUID().toString().replace("-", "");
            mockMvc.perform(post("/api/v1/invitations/accept")
                    .with(csrf())
                    .contentType("application/json")
                    .content(objectMapper.writeValueAsString(java.util.Map.of(
                        "token", objectMapper.readTree(rejectionInvitationResult.getResponse().getContentAsString()).path("token").asText(),
                        "username", rejectionUsername,
                        "displayName", "Rejected User",
                        "password", invitedPassword))))
                .andExpect(status().isCreated());
            MvcResult rejectionPendingResult = mockMvc.perform(get("/api/v1/admin/users/pending").session(adminSession))
                .andExpect(status().isOk())
                .andReturn();
            long rejectedUserId = objectMapper.readTree(rejectionPendingResult.getResponse().getContentAsString())
                .get(0).path("id").asLong();
            mockMvc.perform(post("/api/v1/admin/users/{id}/reject", rejectedUserId).session(adminSession).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
            mockMvc.perform(post("/api/v1/auth/login")
                    .with(csrf())
                    .contentType("application/json")
                    .content(objectMapper.writeValueAsString(java.util.Map.of(
                        "username", rejectionUsername, "password", invitedPassword))))
                .andExpect(status().isUnauthorized());

            MvcResult revocableResult = mockMvc.perform(post("/api/v1/admin/invitations")
                    .session(adminSession)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();
            JsonNode revocable = objectMapper.readTree(revocableResult.getResponse().getContentAsString());
            mockMvc.perform(post("/api/v1/admin/invitations/{id}/revoke", revocable.path("id").asLong())
                    .session(adminSession)
                    .with(csrf()))
                .andExpect(status().isNoContent());
            mockMvc.perform(post("/api/v1/invitations/accept")
                    .with(csrf())
                    .contentType("application/json")
                    .content(objectMapper.writeValueAsString(java.util.Map.of(
                        "token", revocable.path("token").asText(),
                        "username", "revoked" + UUID.randomUUID().toString().replace("-", ""),
                        "displayName", "Revoked User",
                        "password", invitedPassword))))
                .andExpect(status().isBadRequest());
            }

    @Test
    void savesOwnedRecordAndHidesItFromAnotherAccount() throws Exception {
        MockHttpSession ownerSession = login(owner);
        MockHttpSession otherSession = login(other);

        MvcResult exerciseResult = mockMvc.perform(post("/api/v1/exercises")
                        .session(ownerSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"name":"Squat","category":"legs"}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode exercise = objectMapper.readTree(exerciseResult.getResponse().getContentAsString());
        long exerciseId = exercise.path("id").asLong();

        MvcResult recordResult = mockMvc.perform(post("/api/v1/training-sessions")
                        .session(ownerSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"trainingDate":"2026-10-04","exercises":[{"exerciseId":%d,"sets":[{"reps":8,"weightKg":60}]}]}
                                """.formatted(exerciseId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.exercises[0].sets[0].reps").value(8))
                .andReturn();
        long recordId = objectMapper.readTree(recordResult.getResponse().getContentAsString()).path("id").asLong();

        mockMvc.perform(get("/api/v1/training-sessions/{id}", recordId).session(ownerSession))
            .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/training-sessions/{id}", recordId)
                .session(ownerSession)
                .with(csrf())
                .contentType("application/json")
                .content("""
                    {"trainingDate":"2026-10-05","note":"updated","exercises":[{"exerciseId":%d,"sets":[{"durationSeconds":45}]}]}
                    """.formatted(exerciseId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trainingDate").value("2026-10-05"))
            .andExpect(jsonPath("$.exercises[0].sets[0].durationSeconds").value(45));

        mockMvc.perform(get("/api/v1/training-sessions/{id}", recordId).session(otherSession))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        mockMvc.perform(delete("/api/v1/training-sessions/{id}", recordId).session(ownerSession).with(csrf()))
            .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/exercises/{id}", exerciseId).session(ownerSession).with(csrf()))
            .andExpect(status().isNoContent());
        }

        @Test
        void managesExercisesRoutinesAndMeasurements() throws Exception {
        MockHttpSession ownerSession = login(owner);
        MvcResult exerciseResult = mockMvc.perform(post("/api/v1/exercises")
                .session(ownerSession)
                .with(csrf())
                .contentType("application/json")
                .content("""
                    {"name":"Deadlift"}
                    """))
            .andExpect(status().isCreated())
            .andReturn();
        long exerciseId = objectMapper.readTree(exerciseResult.getResponse().getContentAsString()).path("id").asLong();

        mockMvc.perform(put("/api/v1/exercises/{id}", exerciseId)
                .session(ownerSession)
                .with(csrf())
                .contentType("application/json")
                .content("""
                    {"name":"Romanian deadlift","category":"legs"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Romanian deadlift"));
        mockMvc.perform(get("/api/v1/exercises").param("q", "Romanian").session(ownerSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(exerciseId));

        MvcResult routineResult = mockMvc.perform(post("/api/v1/routines")
                .session(ownerSession)
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {"name":"Pull day","description":"Back and legs","exerciseIds":[%d],"exerciseTargets":[{"exerciseId":%d,"type":"time","durationSeconds":45,"weightKg":2.5}]}
                        """.formatted(exerciseId, exerciseId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.exercises[0].name").value("Romanian deadlift"))
                    .andExpect(jsonPath("$.exerciseTargets[0].type").value("time"))
                    .andExpect(jsonPath("$.exerciseTargets[0].durationSeconds").value(45))
                    .andExpect(jsonPath("$.exerciseTargets[0].weightKg").value(2.5))
            .andReturn();
        long routineId = objectMapper.readTree(routineResult.getResponse().getContentAsString()).path("id").asLong();
        mockMvc.perform(get("/api/v1/routines/{id}", routineId).session(ownerSession))
            .andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/routines/{id}", routineId)
                .session(ownerSession)
                .with(csrf())
                .contentType("application/json")
                .content("""
                    {"name":"Pull day 2","exerciseIds":[%d]}
                    """.formatted(exerciseId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Pull day 2"));
        mockMvc.perform(delete("/api/v1/routines/{id}", routineId).session(ownerSession).with(csrf()))
            .andExpect(status().isNoContent());

        MvcResult measurementResult = mockMvc.perform(post("/api/v1/body-measurements")
                .session(ownerSession)
                .with(csrf())
                .contentType("application/json")
                .content("""
                    {"measurementTypeCode":"weight_kg","measuredAt":"2026-10-04T08:00:00Z","value":68.4}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.unit").value("kg"))
            .andReturn();
        long measurementId = objectMapper.readTree(measurementResult.getResponse().getContentAsString()).path("id").asLong();
        mockMvc.perform(get("/api/v1/body-measurements").param("measurementTypeCode", "weight_kg").session(ownerSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(put("/api/v1/body-measurements/{id}", measurementId)
                .session(ownerSession)
                .with(csrf())
                .contentType("application/json")
                .content("""
                    {"measurementTypeCode":"weight_kg","measuredAt":"2026-10-04T08:00:00Z","value":67.9}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.value").value(67.9));
        MockHttpSession otherSession = login(other);
        mockMvc.perform(get("/api/v1/body-measurements")
                .param("measurementTypeCode", "weight_kg")
                .session(otherSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(delete("/api/v1/body-measurements/{id}", measurementId).session(ownerSession).with(csrf()))
            .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/exercises/{id}", exerciseId).session(ownerSession).with(csrf()))
            .andExpect(status().isNoContent());
    }

    @Test
    void estimatesCaloriesOnlyForBuiltInExercisesWithRates() throws Exception {
        MockHttpSession session = login(owner);
        long benchPress = jdbc.queryForObject(
                "SELECT id FROM exercises WHERE exercise_code = 'bench_press'", Long.class);
        long dumbbell = jdbc.queryForObject(
                "SELECT id FROM exercises WHERE exercise_code = 'dumbbell'", Long.class);

        mockMvc.perform(post("/api/v1/calorie-estimates")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"exerciseId\":" + benchPress + ",\"basis\":\"REP\",\"rpe\":8,\"bodyWeightKg\":60,\"reps\":10}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.exerciseCode").value("bench_press"))
                .andExpect(jsonPath("$.activeSeconds").value(30.0))
                .andExpect(jsonPath("$.estimatedCaloriesKcal").value(3.15));

        mockMvc.perform(post("/api/v1/calorie-estimates")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"exerciseId\":" + dumbbell + ",\"basis\":\"REP\",\"rpe\":8,\"bodyWeightKg\":60,\"reps\":10}"))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(post("/api/v1/calorie-estimates")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"exerciseId\":" + benchPress + ",\"basis\":\"REP\",\"rpe\":8,\"bodyWeightKg\":10,\"reps\":10}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/calorie-estimates")
                        .with(csrf())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void storesCalorieEstimateOnSetAndRejectsOthersEstimate() throws Exception {
        MockHttpSession ownerSession = login(owner);
        MockHttpSession otherSession = login(other);
        long benchPress = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'bench_press'", Long.class);
        long treadmill = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'treadmill'", Long.class);

        MvcResult estimate = mockMvc.perform(post("/api/v1/calorie-estimates")
                        .session(ownerSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"exerciseId\":" + benchPress + ",\"basis\":\"REP\",\"rpe\":8,\"bodyWeightKg\":60,\"reps\":10}"))
                .andExpect(status().isCreated())
                .andReturn();
        long estimateId = new ObjectMapper().readTree(estimate.getResponse().getContentAsString()).get("estimateId").asLong();

        String session = "{\"trainingDate\":\"2026-10-13\",\"exercises\":[{\"exerciseId\":%d,\"sets\":[{\"reps\":10,\"weightKg\":40,\"calorieEstimateId\":%d}]}]}";
        mockMvc.perform(post("/api/v1/training-sessions")
                        .session(ownerSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content(session.formatted(benchPress, estimateId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.exercises[0].sets[0].calorieEstimateId").value(estimateId))
                .andExpect(jsonPath("$.exercises[0].sets[0].estimatedCaloriesKcal").value(3.15));

        mockMvc.perform(post("/api/v1/training-sessions")
                        .session(otherSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content(session.formatted(benchPress, estimateId)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/training-sessions")
                        .session(ownerSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content(session.formatted(treadmill, estimateId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void storesBodyWeightInAccountProfile() throws Exception {
        MockHttpSession session = login(owner);

        mockMvc.perform(get("/api/v1/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").exists())
                .andExpect(jsonPath("$.bodyWeightKg").isEmpty());

        mockMvc.perform(put("/api/v1/auth/me/profile")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"bodyWeightKg\":63.5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bodyWeightKg").value(63.5));

        mockMvc.perform(get("/api/v1/auth/me").session(session))
                .andExpect(jsonPath("$.bodyWeightKg").value(63.5));

        mockMvc.perform(put("/api/v1/auth/me/profile")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"bodyWeightKg\":10}"))
                .andExpect(status().isBadRequest());
    }

    private MockHttpSession login(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                java.util.Map.of("username", username, "password", "test-password-123"))))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}