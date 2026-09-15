CREATE TABLE public.crm_externo_encaminhamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id text NOT NULL,
  source_app text NOT NULL DEFAULT 'mcfadministrativo',
  area text NOT NULL CHECK (area IN ('consorcio','solar')),
  motivo text NOT NULL,
  cliente_nome text NOT NULL,
  cliente_email text,
  cliente_telefone text,
  cliente_documento text,
  cliente_endereco jsonb NOT NULL DEFAULT '{}'::jsonb,
  cliente_perfil jsonb NOT NULL DEFAULT '{}'::jsonb,
  historico jsonb NOT NULL DEFAULT '[]'::jsonb,
  anamnese jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric,
  faixa_classificacao text,
  gerente_nome text,
  gerente_email text,
  payload_original jsonb NOT NULL DEFAULT '{}'::jsonb,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','em_atendimento','concluida')),
  responsavel_nome text,
  responsavel_profile_id uuid,
  status_atualizado_em timestamptz NOT NULL DEFAULT now(),
  callback_url text,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_externo_encaminhamentos_external_unique UNIQUE (source_app, external_id)
);

CREATE INDEX idx_crm_externo_enc_deal ON public.crm_externo_encaminhamentos(deal_id);
CREATE INDEX idx_crm_externo_enc_area_status ON public.crm_externo_encaminhamentos(area, status);

GRANT SELECT, INSERT, UPDATE ON public.crm_externo_encaminhamentos TO authenticated;
GRANT ALL ON public.crm_externo_encaminhamentos TO service_role;

ALTER TABLE public.crm_externo_encaminhamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver encaminhamentos externos"
  ON public.crm_externo_encaminhamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem atualizar encaminhamentos externos"
  ON public.crm_externo_encaminhamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_crm_externo_enc_updated_at
  BEFORE UPDATE ON public.crm_externo_encaminhamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();