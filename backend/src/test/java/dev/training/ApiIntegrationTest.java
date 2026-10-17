package dev.training;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.yaml.snakeyaml.Yaml;
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

        long exerciseId = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'squat'", Long.class);

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
        }

        @Test
        void managesExercisesRoutinesAndMeasurements() throws Exception {
        MockHttpSession ownerSession = login(owner);
        long exerciseId = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'leg_press'", Long.class);
        mockMvc.perform(get("/api/v1/exercises").param("q", "レッグプレス").session(ownerSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(exerciseId))
            .andExpect(jsonPath("$[0].shared").doesNotExist());

        MvcResult routineResult = mockMvc.perform(post("/api/v1/routines")
                .session(ownerSession)
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {"name":"Pull day","description":"Back and legs","exerciseIds":[%d],"exerciseTargets":[{"exerciseId":%d,"type":"time","durationSeconds":45,"weightKg":2.5}]}
                        """.formatted(exerciseId, exerciseId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.exercises[0].name").value("レッグプレス"))
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
    }

    @Test
    void estimatesCaloriesForBuiltInExercisesIncludingEquipmentItems() throws Exception {
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
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estimatedCaloriesKcal").value(3.15));

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
    void previewsCaloriesWithTheSameFormulaWithoutStoringThem() throws Exception {
        MockHttpSession session = login(owner);
        long benchPress = jdbc.queryForObject(
                "SELECT id FROM exercises WHERE exercise_code = 'bench_press'", Long.class);
        Integer before = jdbc.queryForObject("SELECT COUNT(*) FROM exercise_calorie_estimates", Integer.class);

        mockMvc.perform(post("/api/v1/calorie-estimates/preview")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"exerciseId\":" + benchPress + ",\"basis\":\"REP\",\"rpe\":8,\"bodyWeightKg\":60,\"reps\":10}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estimateId").doesNotExist())
                .andExpect(jsonPath("$.estimatedCaloriesKcal").value(3.15));

        org.junit.jupiter.api.Assertions.assertEquals(before,
                jdbc.queryForObject("SELECT COUNT(*) FROM exercise_calorie_estimates", Integer.class));

        mockMvc.perform(post("/api/v1/calorie-estimates/preview")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"exerciseId\":" + benchPress + ",\"basis\":\"REP\",\"rpe\":8,\"bodyWeightKg\":10,\"reps\":10}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/calorie-estimates/preview")
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
    void accountResponseHasNoProfileWeightAndTheProfileEndpointIsGone() throws Exception {
        MockHttpSession session = login(owner);

        mockMvc.perform(get("/api/v1/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").exists())
                .andExpect(jsonPath("$.bodyWeightKg").doesNotExist());

        mockMvc.perform(put("/api/v1/auth/me/profile")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"bodyWeightKg\":63.5}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void selectsMetByRpeBandBoundariesAndRoundsToTwoDecimals() throws Exception {
        MockHttpSession session = login(owner);
        long treadmill = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'treadmill'", Long.class);
        long bench = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'bench_press'", Long.class);

        // 80kg, 60 seconds: kcal = MET * 3.5 * 80 / 200 = MET * 1.4
        double[] minuteKcal = {4.9, 4.9, 8.4, 8.4, 11.2, 11.2};
        int[] minuteRpe = {1, 4, 5, 7, 8, 10};
        for (int i = 0; i < minuteRpe.length; i++) {
            estimate(session, treadmill, "MINUTE", minuteRpe[i], "80", "\"durationSeconds\":60")
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.estimatedCaloriesKcal").value(minuteKcal[i]));
        }

        // 80kg, 10 reps at 3 seconds: 30 seconds of work
        estimate(session, bench, "REP", 6, "80", "\"reps\":10")
                .andExpect(jsonPath("$.estimatedCaloriesKcal").value(2.45));
        estimate(session, bench, "REP", 7, "80", "\"reps\":10")
                .andExpect(jsonPath("$.estimatedCaloriesKcal").value(4.2));

        // 3.5 * 3.5 * 60 / 200 = 3.675, rounded half up
        estimate(session, treadmill, "MINUTE", 1, "60", "\"durationSeconds\":60")
                .andExpect(jsonPath("$.estimatedCaloriesKcal").value(3.68));

        estimate(session, treadmill, "MINUTE", 5, "20", "\"durationSeconds\":60").andExpect(status().isCreated());
        estimate(session, treadmill, "MINUTE", 5, "300", "\"durationSeconds\":60").andExpect(status().isCreated());
        estimate(session, treadmill, "MINUTE", 5, "19.9", "\"durationSeconds\":60").andExpect(status().isBadRequest());
        estimate(session, treadmill, "MINUTE", 5, "300.1", "\"durationSeconds\":60").andExpect(status().isBadRequest());
        estimate(session, treadmill, "MINUTE", 0, "80", "\"durationSeconds\":60").andExpect(status().isBadRequest());
        estimate(session, treadmill, "MINUTE", 11, "80", "\"durationSeconds\":60").andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMismatchedBasisAndUnsupportedExercises() throws Exception {
        MockHttpSession session = login(owner);
        long treadmill = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'treadmill'", Long.class);
        long bench = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'bench_press'", Long.class);
        long squat = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'squat'", Long.class);

        estimate(session, treadmill, "MINUTE", 5, "80", "\"reps\":10").andExpect(status().isBadRequest());
        estimate(session, bench, "REP", 5, "80", "\"durationSeconds\":60").andExpect(status().isBadRequest());
        estimate(session, bench, "REP", 5, "80", "\"reps\":10,\"durationSeconds\":60").andExpect(status().isBadRequest());
        estimate(session, bench, "REP", 5, "80", "\"reps\":501").andExpect(status().isBadRequest());
        estimate(session, bench, "HOUR", 5, "80", "\"reps\":10").andExpect(status().isBadRequest());
        // a cardio machine has no repetition rate: the work time of one repetition is unknown
        estimate(session, treadmill, "REP", 5, "80", "\"reps\":10").andExpect(status().isUnprocessableEntity());
        // every built-in strength exercise can be estimated by reps and by time
        estimate(session, squat, "REP", 5, "80", "\"reps\":10").andExpect(status().isCreated());
        // 80kg, 60 seconds at RPE 8: 6.0 MET * 1.4
        estimate(session, bench, "MINUTE", 8, "80", "\"durationSeconds\":60")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estimatedCaloriesKcal").value(8.4));
        estimate(session, 999999L, "REP", 5, "80", "\"reps\":10").andExpect(status().isUnprocessableEntity());

    }

    @Test
    void everyBuiltInExerciseHasACalorieRateAndListsItsBases() throws Exception {
        Integer withoutRate = jdbc.queryForObject("""
                SELECT COUNT(*) FROM exercises e
                WHERE NOT EXISTS (SELECT 1 FROM exercise_calorie_rates r WHERE r.exercise_code = e.exercise_code AND r.enabled = TRUE)
                """, Integer.class);
        org.junit.jupiter.api.Assertions.assertEquals(0, withoutRate);

        MockHttpSession session = login(owner);
        mockMvc.perform(get("/api/v1/exercises").param("q", "トレッドミル").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].calorieEnabled").value(true))
                .andExpect(jsonPath("$[0].calorieBases.length()").value(1))
                .andExpect(jsonPath("$[0].calorieBases[0]").value("MINUTE"))
                .andExpect(jsonPath("$[0].recordType").value("MINUTE"));
        mockMvc.perform(get("/api/v1/exercises").param("q", "ダンベル").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].calorieBases[0]").value("REP"))
                .andExpect(jsonPath("$[0].calorieBases[1]").value("MINUTE"))
                .andExpect(jsonPath("$[0].recordType").value("REP"));

        // 種目ごとに記録形式が1つ決まっており、有酸素マシンだけが時間
        Integer timeExercises = jdbc.queryForObject("SELECT COUNT(*) FROM exercises WHERE record_type = 'MINUTE'", Integer.class);
        Integer cardio = jdbc.queryForObject("SELECT COUNT(*) FROM exercises WHERE category = '有酸素'", Integer.class);
        org.junit.jupiter.api.Assertions.assertEquals(cardio, timeExercises);
    }

    @Test
    void returnsTheRpeOfTheEstimateWithEachSet() throws Exception {
        MockHttpSession session = login(owner);
        long bench = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'bench_press'", Long.class);
        long estimateId = objectMapper.readTree(estimate(session, bench, "REP", 7, "80", "\"reps\":10")
                .andReturn().getResponse().getContentAsString()).get("estimateId").asLong();

        mockMvc.perform(post("/api/v1/training-sessions")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"trainingDate\":\"2026-10-17\",\"exercises\":[{\"exerciseId\":" + bench
                                + ",\"sets\":[{\"reps\":10,\"calorieEstimateId\":" + estimateId + "},{\"reps\":8}]}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.exercises[0].sets[0].rpe").value(7))
                .andExpect(jsonPath("$.exercises[0].sets[1].rpe").isEmpty());
    }

    @Test
    void registersHeightOnceOnTheAccountInsteadOfAsAMeasurement() throws Exception {
        MockHttpSession session = login(owner);
        mockMvc.perform(get("/api/v1/auth/me").session(session))
                .andExpect(jsonPath("$.heightCm").isEmpty());

        mockMvc.perform(patch("/api/v1/auth/me")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"heightCm\":171.5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.heightCm").value(171.5));
        mockMvc.perform(get("/api/v1/auth/me").session(session))
                .andExpect(jsonPath("$.heightCm").value(171.5));

        for (String invalid : new String[] {"49.9", "300.1", "170.25", "null"}) {
            mockMvc.perform(patch("/api/v1/auth/me")
                            .session(session)
                            .with(csrf())
                            .contentType("application/json")
                            .content("{\"heightCm\":" + invalid + "}"))
                    .andExpect(status().isBadRequest());
        }

        // height is no longer a body measurement; weight and body fat still are
        mockMvc.perform(post("/api/v1/body-measurements")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"measurementTypeCode\":\"height_cm\",\"measuredAt\":\"2026-10-17T08:00:00Z\",\"value\":171.5}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/body-measurements")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"measurementTypeCode\":\"body_fat_pct\",\"measuredAt\":\"2026-10-17T08:00:00Z\",\"value\":18.2}"))
                .andExpect(status().isCreated());
    }

    @Test
    void changesTheDisplayNameOfTheLoggedInAccountOnly() throws Exception {
        MockHttpSession session = login(owner);
        mockMvc.perform(patch("/api/v1/auth/me")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"displayName\":\"新しい名前\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("新しい名前"))
                .andExpect(jsonPath("$.username").value(owner));
        mockMvc.perform(patch("/api/v1/auth/me")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"displayName\":\"  \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/v1/auth/me")
                        .session(session)
                        .contentType("application/json")
                        .content("{\"displayName\":\"no csrf\"}"))
                .andExpect(status().isForbidden());
        String otherName = jdbc.queryForObject("SELECT display_name FROM users WHERE username = ?", String.class, other);
        org.junit.jupiter.api.Assertions.assertEquals("", otherName);
    }

    @Test
    void changesThePasswordOnlyWithTheCurrentPassword() throws Exception {
        MockHttpSession session = login(owner);
        String oldSessionId = session.getId();

        mockMvc.perform(put("/api/v1/auth/me/password")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"wrong-password-0\",\"newPassword\":\"brand-new-password-1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_MISMATCH"));
        mockMvc.perform(put("/api/v1/auth/me/password")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"test-password-123\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/v1/auth/me/password")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"test-password-123\",\"newPassword\":\"test-password-123\"}"))
                .andExpect(status().isBadRequest());

        MvcResult changed = mockMvc.perform(put("/api/v1/auth/me/password")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"test-password-123\",\"newPassword\":\"brand-new-password-1\"}"))
                .andExpect(status().isNoContent())
                .andReturn();
        assertNotEquals(oldSessionId, changed.getRequest().getSession(false).getId());

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("username", owner, "password", "test-password-123"))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("username", owner, "password", "brand-new-password-1"))))
                .andExpect(status().isOk());
    }

    @Test
    void usersCannotCreateChangeOrDeleteExercises() throws Exception {
        MockHttpSession session = login(owner);
        long bench = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'bench_press'", Long.class);

        mockMvc.perform(post("/api/v1/exercises")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"name\":\"my bench\",\"category\":\"胸\"}"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
        mockMvc.perform(put("/api/v1/exercises/{id}", bench)
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"name\":\"renamed\"}"))
                .andExpect(status().isMethodNotAllowed());
        mockMvc.perform(delete("/api/v1/exercises/{id}", bench).session(session).with(csrf()))
                .andExpect(status().isMethodNotAllowed());

        Integer ownerColumn = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE LOWER(table_name) = 'exercises' AND LOWER(column_name) = 'owner_user_id'",
                Integer.class);
        org.junit.jupiter.api.Assertions.assertEquals(0, ownerColumn);
        mockMvc.perform(get("/api/v1/exercises/{id}", bench).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("ベンチプレス"));
    }

    @Test
    void reportsExerciseProgressPerSessionForTheOwnerOnly() throws Exception {
        MockHttpSession ownerSession = login(owner);
        MockHttpSession otherSession = login(other);
        long bench = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'bench_press'", Long.class);
        long treadmill = jdbc.queryForObject("SELECT id FROM exercises WHERE exercise_code = 'treadmill'", Long.class);
        String session = "{\"trainingDate\":\"%s\",\"exercises\":[{\"exerciseId\":%d,\"sets\":%s}]}";

        createSession(ownerSession, session.formatted("2026-10-01", bench,
                "[{\"reps\":10,\"weightKg\":40},{\"reps\":8,\"weightKg\":45},{\"durationSeconds\":30}]"));
        createSession(ownerSession, session.formatted("2026-10-08", bench, "[{\"reps\":12}]"));
        createSession(ownerSession, session.formatted("2026-10-15", treadmill, "[{\"durationSeconds\":600}]"));
        createSession(otherSession, session.formatted("2026-10-02", bench, "[{\"reps\":5,\"weightKg\":100}]"));

        mockMvc.perform(get("/api/v1/statistics/exercises/{id}", bench).session(ownerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exerciseName").value("ベンチプレス"))
                .andExpect(jsonPath("$.points.length()").value(2))
                .andExpect(jsonPath("$.points[0].trainingDate").value("2026-10-01"))
                .andExpect(jsonPath("$.points[0].maxWeightKg").value(45))
                // 40*10 + 45*8; the time set has no reps so it is not part of the volume
                .andExpect(jsonPath("$.points[0].volumeKg").value(760))
                .andExpect(jsonPath("$.points[0].totalReps").value(18))
                .andExpect(jsonPath("$.points[0].totalDurationSeconds").value(30))
                .andExpect(jsonPath("$.points[0].setCount").value(3))
                // no weight entered: no max weight and no volume, not zero
                .andExpect(jsonPath("$.points[1].maxWeightKg").isEmpty())
                .andExpect(jsonPath("$.points[1].volumeKg").isEmpty())
                .andExpect(jsonPath("$.points[1].totalReps").value(12));

        mockMvc.perform(get("/api/v1/statistics/exercises/{id}", bench).param("from", "2026-10-05").session(ownerSession))
                .andExpect(jsonPath("$.points.length()").value(1))
                .andExpect(jsonPath("$.points[0].trainingDate").value("2026-10-08"));
        mockMvc.perform(get("/api/v1/statistics/exercises/{id}", bench)
                        .param("from", "2026-10-10").param("to", "2026-10-01").session(ownerSession))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/statistics/exercises/{id}", 999999L).session(ownerSession))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/statistics/exercises").session(ownerSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].exerciseName").value("トレッドミル"))
                .andExpect(jsonPath("$[1].exerciseName").value("ベンチプレス"))
                .andExpect(jsonPath("$[1].sessionCount").value(2))
                .andExpect(jsonPath("$[1].lastTrainingDate").value("2026-10-08"));
        mockMvc.perform(get("/api/v1/statistics/exercises").session(otherSession))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sessionCount").value(1));
        mockMvc.perform(get("/api/v1/statistics/exercises/{id}", bench).session(otherSession))
                .andExpect(jsonPath("$.points.length()").value(1))
                .andExpect(jsonPath("$.points[0].maxWeightKg").value(100));
    }

    private void createSession(MockHttpSession session, String body) throws Exception {
        mockMvc.perform(post("/api/v1/training-sessions")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isCreated());
    }

    private org.springframework.test.web.servlet.ResultActions estimate(
            MockHttpSession session, long exerciseId, String basis, int rpe, String bodyWeightKg, String amount)
            throws Exception {
        return mockMvc.perform(post("/api/v1/calorie-estimates")
                .session(session)
                .with(csrf())
                .contentType("application/json")
                .content("{\"exerciseId\":" + exerciseId + ",\"basis\":\"" + basis + "\",\"rpe\":" + rpe
                        + ",\"bodyWeightKg\":" + bodyWeightKg + "," + amount + "}"));
    }

    @Test
    void exposesRequestIdAndHealthProbesWithoutLogin() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-Id"));
        mockMvc.perform(get("/actuator/health").header("X-Request-Id", "abc-123"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-Id", "abc-123"));
        MvcResult replaced = mockMvc.perform(get("/actuator/health").header("X-Request-Id", "bad id!"))
                .andExpect(status().isOk())
                .andReturn();
        assertNotEquals("bad id!", replaced.getResponse().getHeader("X-Request-Id"));
    }

    @Test
    void generatedApiDocsMatchTheOpenApiContract() throws Exception {
        MockHttpSession session = login(owner);
        String generated = mockMvc.perform(get("/v3/api-docs").session(session))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Path output = Path.of("build", "openapi", "api-docs.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, generated);

        Set<String> actual = new TreeSet<>();
        new ObjectMapper().readTree(generated).get("paths").fields().forEachRemaining(path -> {
            if (!path.getKey().startsWith("/api/v1/")) {
                return;
            }
            path.getValue().fieldNames().forEachRemaining(method -> actual.add(operation(method, path.getKey().substring("/api/v1".length()))));
        });

        Set<String> documented = new TreeSet<>();
        Map<String, Object> spec = readSpec();
        @SuppressWarnings("unchecked")
        Map<String, Map<String, Object>> paths = (Map<String, Map<String, Object>>) spec.get("paths");
        paths.forEach((path, item) -> item.keySet().stream()
                .filter(key -> Set.of("get", "post", "put", "delete", "patch").contains(key))
                .forEach(method -> documented.add(operation(method, path))));

        Set<String> undocumented = new TreeSet<>(actual);
        undocumented.removeAll(documented);
        Set<String> unimplemented = new TreeSet<>(documented);
        unimplemented.removeAll(actual);
        org.junit.jupiter.api.Assertions.assertTrue(undocumented.isEmpty() && unimplemented.isEmpty(),
                "implemented but not in docs/openapi.yaml: " + undocumented + "; documented but not implemented: " + unimplemented);
    }

    private static String operation(String method, String path) {
        return method.toUpperCase() + " " + path.replaceAll("\\{[^}]+}", "{}");
    }

    private static Map<String, Object> readSpec() throws IOException {
        try (var reader = Files.newBufferedReader(Path.of("..", "docs", "openapi.yaml"))) {
            return new Yaml().load(reader);
        }
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