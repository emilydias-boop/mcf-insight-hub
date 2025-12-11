-- Criar contatos de teste para a pipeline Twilio
INSERT INTO crm_contacts (clint_id, name, email, phone, origin_id)
SELECT 
  'twilio-test-contact-1',
  'Lead Teste Twilio 1',
  'teste1@exemplo.com',
  '+5511999990001',
  id
FROM crm_origins WHERE name = 'Twilio – Teste'
ON CONFLICT (clint_id) DO NOTHING;

INSERT INTO crm_contacts (clint_id, name, email, phone, origin_id)
SELECT 
  'twilio-test-contact-2',
  'Lead Teste Twilio 2',
  'teste2@exemplo.com',
  '+5511999990002',
  id
FROM crm_origins WHERE name = 'Twilio – Teste'
ON CONFLICT (clint_id) DO NOTHING;

INSERT INTO crm_contacts (clint_id, name, email, phone, origin_id)
SELECT 
  'twilio-test-contact-3',
  'Lead Teste Twilio 3',
  'teste3@exemplo.com',
  '+5511999990003',
  id
FROM crm_origins WHERE name = 'Twilio – Teste'
ON CONFLICT (clint_id) DO NOTHING;

-- Criar deals de teste vinculados aos contatos e stages
INSERT INTO crm_deals (clint_id, name, value, origin_id, stage_id, contact_id)
SELECT 
  'twilio-test-deal-1',
  'Deal Teste Twilio 1',
  1000,
  o.id,
  s.id,
  c.id
FROM crm_origins o
CROSS JOIN crm_stages s
CROSS JOIN crm_contacts c
WHERE o.name = 'Twilio – Teste' 
  AND s.origin_id = o.id 
  AND s.stage_name = 'Novo Lead'
  AND c.clint_id = 'twilio-test-contact-1'
ON CONFLICT (clint_id) DO NOTHING;

INSERT INTO crm_deals (clint_id, name, value, origin_id, stage_id, contact_id)
SELECT 
  'twilio-test-deal-2',
  'Deal Teste Twilio 2',
  2000,
  o.id,
  s.id,
  c.id
FROM crm_origins o
CROSS JOIN crm_stages s
CROSS JOIN crm_contacts c
WHERE o.name = 'Twilio – Teste' 
  AND s.origin_id = o.id 
  AND s.stage_name = 'Em Contato'
  AND c.clint_id = 'twilio-test-contact-2'
ON CONFLICT (clint_id) DO NOTHING;

INSERT INTO crm_deals (clint_id, name, value, origin_id, stage_id, contact_id)
SELECT 
  'twilio-test-deal-3',
  'Deal Teste Twilio 3',
  3000,
  o.id,
  s.id,
  c.id
FROM crm_origins o
CROSS JOIN crm_stages s
CROSS JOIN crm_contacts c
WHERE o.name = 'Twilio – Teste' 
  AND s.origin_id = o.id 
  AND s.stage_name = 'Qualificado'
  AND c.clint_id = 'twilio-test-contact-3'
ON CONFLICT (clint_id) DO NOTHING;