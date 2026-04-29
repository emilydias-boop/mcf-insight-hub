-- 1. Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('no-show-evidence', 'no-show-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de validações
CREATE TABLE IF NOT EXISTS public.no_show_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID,
  meeting_slot_id UUID,
  attendee_id UUID,
  lead_phone TEXT,
  evidence_path TEXT NOT NULL,
  ai_verdict TEXT CHECK (ai_verdict IN ('confirmed_no_show','not_no_show','uncertain','error')),
  ai_reasoning TEXT,
  ai_extracted_phone TEXT,
  phone_match BOOLEAN,
  ai_model TEXT,
  ai_raw_response JSONB,
  human_decision TEXT CHECK (human_decision IN ('no_show','rescheduled','attended','other')),
  human_overrode_ai BOOLEAN DEFAULT false,
  human_justification TEXT,
  performed_by UUID,
  performed_by_role TEXT,
  bu_origin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsv_deal ON public.no_show_validations(deal_id);
CREATE INDEX IF NOT EXISTS idx_nsv_attendee ON public.no_show_validations(attendee_id);
CREATE INDEX IF NOT EXISTS idx_nsv_created ON public.no_show_validations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nsv_overrode ON public.no_show_validations(human_overrode_ai) WHERE human_overrode_ai = true;

ALTER TABLE public.no_show_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own no-show validations"
ON public.no_show_validations FOR INSERT TO authenticated
WITH CHECK (performed_by = auth.uid());

CREATE POLICY "Users can view their own validations"
ON public.no_show_validations FOR SELECT TO authenticated
USING (performed_by = auth.uid());

CREATE POLICY "Leadership can view all validations"
ON public.no_show_validations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
);

CREATE POLICY "Leadership can update validations"
ON public.no_show_validations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
);

CREATE TRIGGER trg_nsv_updated_at
BEFORE UPDATE ON public.no_show_validations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Storage policies
CREATE POLICY "Authenticated users can upload no-show evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'no-show-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users and leadership can view no-show evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'no-show-evidence'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  )
);

CREATE POLICY "Leadership can delete no-show evidence"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'no-show-evidence'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

-- 4. Settings globais
CREATE TABLE IF NOT EXISTS public.no_show_ai_settings (
  id INT PRIMARY KEY DEFAULT 1,
  mode TEXT NOT NULL DEFAULT 'suggest' CHECK (mode IN ('suggest','block','audit')),
  require_evidence BOOLEAN NOT NULL DEFAULT true,
  applies_to_roles TEXT[] NOT NULL DEFAULT ARRAY['sdr','closer'],
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT only_one_row CHECK (id = 1)
);

INSERT INTO public.no_show_ai_settings (id, mode) VALUES (1, 'suggest')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.no_show_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read no-show settings"
ON public.no_show_ai_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can update no-show settings"
ON public.no_show_ai_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));