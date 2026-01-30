-- Zerar overrides das transações duplicadas que estão inflando o bruto
-- Essas transações 'make' têm override mas já existe transação 'primeira' para o mesmo cliente
UPDATE hubla_transactions
SET gross_override = 0
WHERE id IN (
  '10695e63-471d-4181-9d52-5e300c97433f',  -- André Raineri
  '1569c31f-8271-416d-a9df-de8a79d315df',  -- Arão Young
  'c89e7e6a-1c62-495b-93ac-37a2018954c1',  -- Henrique
  'd3e063ab-1725-4fe3-95d7-b56559371d2f'   -- Izaquiel
);