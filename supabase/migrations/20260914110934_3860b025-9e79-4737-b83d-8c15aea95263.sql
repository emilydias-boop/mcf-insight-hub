ALTER TABLE public.manual_sale_attributions
  ADD COLUMN IF NOT EXISTS deal_id uuid NULL REFERENCES public.crm_deals(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.manual_sale_attributions.deal_id IS
  'Negócio (crm_deals) ao qual esta atribuição manual se refere. Nulo nas atribuições antigas, que continuam sem segmento ICP. Quando preenchido, permite resolver o segmento A/B/C pelo crm_deals.icp_segment do negócio.';

CREATE INDEX IF NOT EXISTS idx_manual_sale_attributions_deal_id
  ON public.manual_sale_attributions (deal_id);