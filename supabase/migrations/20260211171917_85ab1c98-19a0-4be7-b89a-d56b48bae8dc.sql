
-- 1. Criar stages "SEM SUCESSO" nas duas pipelines do Consórcio
INSERT INTO crm_stages (id, stage_name, stage_order, origin_id, color, clint_id)
VALUES
  (gen_random_uuid(), 'SEM SUCESSO', 10, '4e2b810a-6782-4ce9-9c0d-10d04c018636', '#ef4444', 'sem-sucesso-vda'),
  (gen_random_uuid(), 'SEM SUCESSO', 13, '7d7b1cb5-2a44-4552-9eff-c3b798646b78', '#ef4444', 'sem-sucesso-ea');

-- 2. Criar tabela consorcio_proposals
CREATE TABLE public.consorcio_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  proposal_date date DEFAULT CURRENT_DATE,
  proposal_details text,
  valor_credito numeric,
  prazo_meses integer,
  tipo_produto text,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','recusada')),
  aceite_date date,
  motivo_recusa text,
  consortium_card_id uuid REFERENCES consortium_cards(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.consorcio_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage proposals"
  ON public.consorcio_proposals FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 4. Trigger para updated_at
CREATE TRIGGER update_consorcio_proposals_updated_at
  BEFORE UPDATE ON public.consorcio_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_automation_updated_at();
