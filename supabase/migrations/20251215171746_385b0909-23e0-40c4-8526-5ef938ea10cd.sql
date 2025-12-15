-- Adicionar display_name às tabelas para nomes amigáveis
ALTER TABLE crm_groups ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE crm_origins ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Adicionar campo pipeline_type para classificar funis
ALTER TABLE crm_origins ADD COLUMN IF NOT EXISTS pipeline_type TEXT DEFAULT 'outros';

-- Atualizar nomes amigáveis dos principais funis
UPDATE crm_origins SET 
  display_name = 'Inside Sales – Principal',
  pipeline_type = 'inside_sales'
WHERE name = 'PIPELINE INSIDE SALES';

UPDATE crm_origins SET 
  display_name = 'Inside Sales – Crédito',
  pipeline_type = 'inside_sales'
WHERE name = 'INSIDE SALES - CREDITO';

UPDATE crm_origins SET 
  display_name = 'A010 – Construir para Alugar',
  pipeline_type = 'a010'
WHERE name ILIKE '%Hubla%' AND name ILIKE '%Construir%';

UPDATE crm_origins SET 
  display_name = 'MCF Capital',
  pipeline_type = 'mcf_capital'
WHERE name ILIKE '%MCF CAPITAL%';

UPDATE crm_origins SET 
  display_name = 'Pós-venda MCF',
  pipeline_type = 'pos_venda'
WHERE name ILIKE '%PÓS VENDA%' OR name ILIKE '%POS VENDA%';

UPDATE crm_origins SET 
  display_name = 'Produto Imobiliário',
  pipeline_type = 'produto_imobiliario'
WHERE name ILIKE '%Produto Imobiliário%';