ALTER TABLE users ADD COLUMN body_weight_kg DECIMAL(5,2) NULL;
ALTER TABLE users ADD CONSTRAINT chk_users_body_weight CHECK (body_weight_kg IS NULL OR (body_weight_kg >= 20 AND body_weight_kg <= 300));
