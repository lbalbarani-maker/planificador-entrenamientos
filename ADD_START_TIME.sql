-- Añadir campo start_time para el cronómetro en tiempo real
ALTER TABLE hockey_matches ADD COLUMN IF NOT EXISTS start_time BIGINT;
