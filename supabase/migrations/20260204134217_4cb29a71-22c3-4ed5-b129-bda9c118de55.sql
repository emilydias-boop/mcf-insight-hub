-- Fix stage_id for VIVER DE ALUGUEL pipeline deals
-- Maps old stage IDs from other pipelines to correct VIVER DE ALUGUEL stage IDs

UPDATE crm_deals
SET stage_id = CASE stage_id
  -- Novo Lead
  WHEN '87447ae0-b203-4217-887f-604f48ccc890' THEN '2c69bf1d-94d5-4b6d-928d-dcf12da2d78c'
  -- Lead Qualificado
  WHEN '92e0f271-564d-4930-abf0-c9a431c533e6' THEN '1c798114-fb5f-4648-849e-846e764b0fa3'
  -- Reunião 1 Agendada
  WHEN '23524566-ed63-473c-9466-e9152f6a47ba' THEN '3a189b34-3ec2-41dd-a1b3-dd022363cf81'
  -- NO-SHOW
  WHEN 'bb69af6a-646f-4743-b32d-9d1dbf243ae4' THEN '95b7cfa2-8a23-4b01-af42-973097a36c7d'
  -- Reunião 1 Realizada
  WHEN 'fd937fc5-826a-4e36-b171-2dfe48509beb' THEN '0f450ec9-0f00-4fbe-8400-cdb2440897e5'
  -- Contrato Pago
  WHEN 'e93f1934-024b-4d07-839c-10a2c8227fdd' THEN 'a35fea26-805e-40d5-b604-56fd6319addf'
  -- Venda realizada
  WHEN '1ba95c4f-6870-46d5-b935-435ccc74a23b' THEN 'aa194279-c40e-458d-80aa-c5179b414658'
  ELSE stage_id
END
WHERE origin_id = '4e2b810a-6782-4ce9-9c0d-10d04c018636'
  AND stage_id IN (
    '87447ae0-b203-4217-887f-604f48ccc890',
    '92e0f271-564d-4930-abf0-c9a431c533e6',
    '23524566-ed63-473c-9466-e9152f6a47ba',
    'bb69af6a-646f-4743-b32d-9d1dbf243ae4',
    'fd937fc5-826a-4e36-b171-2dfe48509beb',
    'e93f1934-024b-4d07-839c-10a2c8227fdd',
    '1ba95c4f-6870-46d5-b935-435ccc74a23b'
  );