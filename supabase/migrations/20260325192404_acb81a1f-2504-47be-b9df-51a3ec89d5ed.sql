-- Limpar aspas literais dos nomes de contatos
UPDATE crm_contacts
SET name = TRIM(BOTH '"' FROM TRIM(BOTH '''' FROM name))
WHERE name LIKE '"%"' OR name LIKE '''%''';

-- Limpar aspas literais dos telefones de contatos
UPDATE crm_contacts
SET phone = TRIM(BOTH '"' FROM TRIM(BOTH '''' FROM phone))
WHERE phone LIKE '"%"' OR phone LIKE '''%''';

-- Limpar aspas literais dos nomes de deals
UPDATE crm_deals
SET name = TRIM(BOTH '"' FROM TRIM(BOTH '''' FROM name))
WHERE name LIKE '"%"' OR name LIKE '''%''';