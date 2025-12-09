-- Correção de dados Make com taxa da Hubla ao invés de valor líquido
-- e remoção de duplicatas

-- 1. Corrigir Patrick Silva: R$ 36,24 → R$ 460,76
UPDATE hubla_transactions 
SET net_value = 460.76,
    raw_data = jsonb_set(COALESCE(raw_data::jsonb, '{}'::jsonb), '{valor_corrigido_manualmente}', 'true')
WHERE hubla_id = 'make_contrato_1765225177985_silvades';

-- 2. Corrigir José Lucas: R$ 36,24 → R$ 460,76
UPDATE hubla_transactions 
SET net_value = 460.76,
    raw_data = jsonb_set(COALESCE(raw_data::jsonb, '{}'::jsonb), '{valor_corrigido_manualmente}', 'true')
WHERE hubla_id = 'make_contrato_1765278498840_lucas375';

-- 3. Corrigir Lucas Gabriel: valor Make incorreto - manter apenas Hubla
-- Verificar se existe registro Hubla primeiro e remover Make duplicado
DELETE FROM hubla_transactions 
WHERE hubla_id = 'make_contrato_1765230189185_lucasgab';

-- 4. Remover duplicatas Make onde Hubla já tem o registro correto
DELETE FROM hubla_transactions WHERE hubla_id IN (
  'make_contrato_1765223114670_boanerge',  -- Boanerges (duplicata)
  'make_contrato_1765223520477_renatopr',  -- Renato (duplicata)
  'make_contrato_1765223824158_velamesh',  -- Agenário (duplicata)
  'make_contrato_1765227602396_charles2'   -- Charles (duplicata)
);

-- 5. Inserir Getúlio Júnior (faltando no banco)
INSERT INTO hubla_transactions (
  hubla_id, 
  event_type, 
  product_name, 
  product_category,
  product_price, 
  net_value, 
  customer_name, 
  customer_email,
  customer_phone, 
  sale_date, 
  sale_status, 
  source
) VALUES (
  'manual_contrato_getulio_20251206',
  'invoice.payment_succeeded',
  'A000 - Contrato',
  'incorporador',
  397,
  367.55,
  'Getúlio Júnior',
  'matiasfarmaceutico@hotmail.com',
  '+5592994879110',
  '2025-12-06T12:00:00-03:00',
  'completed',
  'manual'
)
ON CONFLICT (hubla_id) DO NOTHING;