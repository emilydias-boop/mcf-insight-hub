-- Adicionar campos de próxima ação e produto ao crm_deals
ALTER TABLE crm_deals 
ADD COLUMN IF NOT EXISTS next_action_type text,
ADD COLUMN IF NOT EXISTS next_action_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_action_note text,
ADD COLUMN IF NOT EXISTS product_name text;

-- Criar índice para próximas ações pendentes
CREATE INDEX IF NOT EXISTS idx_crm_deals_next_action_date ON crm_deals(next_action_date) WHERE next_action_date IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN crm_deals.next_action_type IS 'Tipo da próxima ação: ligar, whatsapp, email, reuniao';
COMMENT ON COLUMN crm_deals.next_action_date IS 'Data e hora da próxima ação agendada';
COMMENT ON COLUMN crm_deals.next_action_note IS 'Observação rápida sobre a próxima ação';
COMMENT ON COLUMN crm_deals.product_name IS 'Nome do produto: A010, Incorporador, Parceiro 50K, etc';