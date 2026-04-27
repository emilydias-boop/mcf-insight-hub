-- Adiciona coluna linked_deal_id em hubla_transactions para vincular pagamentos Outside diretamente ao deal
-- (quando não há attendee R1, mas o deal foi reconhecido via webhook)
ALTER TABLE public.hubla_transactions 
ADD COLUMN IF NOT EXISTS linked_deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hubla_transactions_linked_deal_id 
ON public.hubla_transactions(linked_deal_id) 
WHERE linked_deal_id IS NOT NULL;

COMMENT ON COLUMN public.hubla_transactions.linked_deal_id IS 
'Vinculação direta a um deal do CRM, usada para Outsides sem R1 que foram reconhecidos pelo webhook da Hubla.';