-- Atualizar todos os registros existentes de 3 para 4 leads
UPDATE closer_availability SET max_slots_per_hour = 4 WHERE max_slots_per_hour = 3;

-- Alterar o valor default da coluna para 4
ALTER TABLE closer_availability ALTER COLUMN max_slots_per_hour SET DEFAULT 4;