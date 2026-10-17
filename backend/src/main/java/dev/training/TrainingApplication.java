package dev.training;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.Locale;

@SpringBootApplication
public class TrainingApplication {
    public static void main(String[] args) {
        SpringApplication.run(TrainingApplication.class, args);
    }

    @Bean
    ApplicationRunner provisionInitialAdmin(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        return args -> {
            String username = System.getenv("TRAININGAPP_ADMIN_USERNAME");
            String password = System.getenv("TRAININGAPP_ADMIN_PASSWORD");
            if (username == null || username.isBlank() || password == null || password.length() < 12) {
                return;
            }

            String normalizedUsername = username.trim().toLowerCase(Locale.ROOT);
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class);
            if (count != null && count == 0) {
                jdbc.update(
                        "INSERT INTO users (username, display_name, password_hash, role, status) VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')",
                        normalizedUsername,
                        normalizedUsername,
                        passwordEncoder.encode(password));
            }
        };
    }
}