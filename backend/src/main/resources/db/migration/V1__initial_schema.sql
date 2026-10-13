CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    display_name VARCHAR(100) NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT chk_users_role CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'PENDING_APPROVAL', 'REJECTED'))
);

CREATE TABLE invitations (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    token_hash CHAR(64) NOT NULL,
    created_by_user_id BIGINT NOT NULL,
    requested_user_id BIGINT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    accepted_at TIMESTAMP(6) NULL,
    revoked_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_invitations_token_hash UNIQUE (token_hash),
    CONSTRAINT uq_invitations_requested_user UNIQUE (requested_user_id),
    CONSTRAINT fk_invitations_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_invitations_requested_user FOREIGN KEY (requested_user_id) REFERENCES users(id),
    INDEX idx_invitations_expires (expires_at)
);

CREATE TABLE audit_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_user_id BIGINT NOT NULL,
    action VARCHAR(40) NOT NULL,
    target_type VARCHAR(40) NOT NULL,
    target_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_audit_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
    INDEX idx_audit_events_target (target_type, target_id, created_at)
);

CREATE TABLE exercises (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_user_id BIGINT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NULL,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_exercises_owner FOREIGN KEY (owner_user_id) REFERENCES users(id),
    INDEX idx_exercises_owner_name (owner_user_id, name),
    INDEX idx_exercises_name (name)
);

CREATE TABLE training_sessions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    training_date DATE NOT NULL,
    note VARCHAR(1000) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_sessions_owner_date (user_id, training_date, created_at)
);

CREATE TABLE session_exercises (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    exercise_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    note VARCHAR(500) NULL,
    CONSTRAINT fk_session_exercises_session FOREIGN KEY (session_id) REFERENCES training_sessions(id),
    CONSTRAINT fk_session_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id),
    CONSTRAINT uq_session_exercise_order UNIQUE (session_id, display_order)
);

CREATE TABLE set_records (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_exercise_id BIGINT NOT NULL,
    set_number INT NOT NULL,
    reps INT NULL,
    duration_seconds INT NULL,
    weight_kg DECIMAL(7,2) NULL,
    CONSTRAINT fk_sets_session_exercise FOREIGN KEY (session_exercise_id) REFERENCES session_exercises(id),
    CONSTRAINT uq_set_number UNIQUE (session_exercise_id, set_number),
    CONSTRAINT chk_set_exclusive CHECK ((reps IS NOT NULL AND duration_seconds IS NULL) OR (reps IS NULL AND duration_seconds IS NOT NULL)),
    CONSTRAINT chk_set_reps CHECK (reps IS NULL OR reps > 0),
    CONSTRAINT chk_set_duration CHECK (duration_seconds IS NULL OR duration_seconds > 0),
    CONSTRAINT chk_set_weight CHECK (weight_kg IS NULL OR weight_kg >= 0)
);

CREATE TABLE measurement_types (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    display_order INT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    min_value DECIMAL(10,3) NULL,
    max_value DECIMAL(10,3) NULL,
    CONSTRAINT uq_measurement_type_code UNIQUE (code),
    CONSTRAINT uq_measurement_type_order UNIQUE (display_order)
);

CREATE TABLE body_measurements (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    measurement_type_id BIGINT NOT NULL,
    measured_at TIMESTAMP(6) NOT NULL,
    measurement_value DECIMAL(10,3) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_measurements_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_measurements_type FOREIGN KEY (measurement_type_id) REFERENCES measurement_types(id),
    INDEX idx_measurements_owner_type_time (user_id, measurement_type_id, measured_at)
);

CREATE TABLE routines (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_routines_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_routines_owner (user_id)
);

CREATE TABLE routine_exercises (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    routine_id BIGINT NOT NULL,
    exercise_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    CONSTRAINT fk_routine_exercises_routine FOREIGN KEY (routine_id) REFERENCES routines(id),
    CONSTRAINT fk_routine_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id),
    CONSTRAINT uq_routine_exercise_order UNIQUE (routine_id, display_order)
);

INSERT INTO measurement_types (code, name, unit, display_order, min_value, max_value) VALUES
    ('height_cm', '身長', 'cm', 1, 50, 300),
    ('weight_kg', '体重', 'kg', 2, 2, 700);