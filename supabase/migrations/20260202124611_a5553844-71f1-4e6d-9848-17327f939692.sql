-- 1. Vincular Thaynar Tavares ao SDR correspondente
UPDATE employees 
SET sdr_id = '66a5a9ea-6d48-4831-b91c-7d79cf00aac2'
WHERE id = 'fbd5ed07-c45c-41af-9e55-37c2d7faf613';

-- 2. Vincular Julio Caetano ao SDR correspondente
UPDATE employees 
SET sdr_id = '21393c7b-faa7-42e2-b1d8-920e3a808b33'
WHERE id = '74d4da35-2f43-43f0-a0b0-29bd6d51c04a';

-- 3. Vincular Jéssica Bellini ao SDR correspondente
UPDATE employees 
SET sdr_id = '566e3075-5903-4b9b-941b-ef95b9fa09d8'
WHERE id = '93d0e6ac-2e66-4372-8974-2af228f07628';

-- 4. Desativar SDR de Claudia Carielo (sócia R2)
UPDATE sdr 
SET active = false 
WHERE id = '4eb4991d-e753-49e5-955b-c3ebceafe6e4';

-- 5. Desativar SDR de Thobson Motta (sócio R2)
UPDATE sdr 
SET active = false 
WHERE id = '761a3f5b-d854-46e3-8b0d-05c1b7680216';

-- 6. Preencher departamento_vigente para payouts existentes (baseado no RH atual)
UPDATE sdr_month_payout p
SET departamento_vigente = e.departamento
FROM employees e
WHERE e.sdr_id = p.sdr_id
AND p.departamento_vigente IS NULL;

-- 7. Corrigir manualmente o Vinicius em Janeiro (transferido em Fevereiro)
UPDATE sdr_month_payout 
SET departamento_vigente = 'BU - Incorporador 50K'
WHERE sdr_id = '11111111-0001-0001-0001-000000000010'
AND ano_mes = '2026-01';