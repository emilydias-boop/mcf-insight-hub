-- 1) Backup table
CREATE TABLE IF NOT EXISTS public.bkp_cotas_duplicadas_20260821 (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela text NOT NULL,
  registro_id uuid,
  dados jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bkp_cotas_duplicadas_20260821 TO authenticated;
GRANT ALL ON public.bkp_cotas_duplicadas_20260821 TO service_role;

ALTER TABLE public.bkp_cotas_duplicadas_20260821 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read cotas duplicadas backup"
ON public.bkp_cotas_duplicadas_20260821
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Backup rows
INSERT INTO public.bkp_cotas_duplicadas_20260821 (tabela, registro_id, dados)
SELECT 'consortium_cards', c.id, to_jsonb(c)
FROM public.consortium_cards c
WHERE c.id IN (
  'df8071bb-e60d-4420-8ece-08cd4741e185','8a829271-34ab-4ff9-8f8f-a09471fa5ebe',
  'cd5bd31c-d91f-44a6-9055-5c209040aaee','e154eaac-5513-43e8-a1ec-ce998c6597e6'
);

INSERT INTO public.bkp_cotas_duplicadas_20260821 (tabela, registro_id, dados)
SELECT 'consorcio_pending_registrations', p.id, to_jsonb(p)
FROM public.consorcio_pending_registrations p
WHERE p.consortium_card_id IN (
  '8a829271-34ab-4ff9-8f8f-a09471fa5ebe','e154eaac-5513-43e8-a1ec-ce998c6597e6'
);

INSERT INTO public.bkp_cotas_duplicadas_20260821 (tabela, registro_id, dados)
SELECT 'consortium_card_activity_log', l.id, to_jsonb(l)
FROM public.consortium_card_activity_log l
WHERE l.card_id IN (
  '8a829271-34ab-4ff9-8f8f-a09471fa5ebe','e154eaac-5513-43e8-a1ec-ce998c6597e6'
);

-- 3) Merge: carry the Embracon contract number to the surviving card
UPDATE public.consortium_cards
SET contrato_embracon = '0011084638', updated_at = now()
WHERE id = 'df8071bb-e60d-4420-8ece-08cd4741e185'
  AND (contrato_embracon IS NULL OR contrato_embracon = '');

-- 4) Repoint pending registrations to the surviving cards
UPDATE public.consorcio_pending_registrations
SET consortium_card_id = 'df8071bb-e60d-4420-8ece-08cd4741e185'
WHERE consortium_card_id = '8a829271-34ab-4ff9-8f8f-a09471fa5ebe';

UPDATE public.consorcio_pending_registrations
SET consortium_card_id = 'cd5bd31c-d91f-44a6-9055-5c209040aaee'
WHERE consortium_card_id = 'e154eaac-5513-43e8-a1ec-ce998c6597e6';

-- 5) Delete duplicates (reserva rows)
DELETE FROM public.consortium_cards
WHERE id IN ('8a829271-34ab-4ff9-8f8f-a09471fa5ebe','e154eaac-5513-43e8-a1ec-ce998c6597e6');

-- 6) Security fix: restrict manual sale inserts
DROP POLICY IF EXISTS "System can insert hubla transactions" ON public.hubla_transactions;

CREATE POLICY "Staff can insert manual transactions"
ON public.hubla_transactions
FOR INSERT TO authenticated
WITH CHECK (
  source = 'manual'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR public.has_role(auth.uid(), 'closer'::app_role)
  )
);