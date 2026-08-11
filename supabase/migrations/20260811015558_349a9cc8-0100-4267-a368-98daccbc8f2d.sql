ALTER TABLE public.sdr_ramal_mapping
  ADD COLUMN IF NOT EXISTS auto_dialer_engine text NOT NULL DEFAULT 'twilio';

ALTER TABLE public.sdr_ramal_mapping
  DROP CONSTRAINT IF EXISTS sdr_ramal_mapping_auto_dialer_engine_check;

ALTER TABLE public.sdr_ramal_mapping
  ADD CONSTRAINT sdr_ramal_mapping_auto_dialer_engine_check
  CHECK (auto_dialer_engine IN ('twilio','sonax'));

GRANT SELECT ON public.sdr_ramal_mapping TO authenticated;
GRANT ALL ON public.sdr_ramal_mapping TO service_role;

-- Permitir que o autor da atividade registre o resultado (outcome) da própria ligação
GRANT UPDATE ON public.deal_activities TO authenticated;

DROP POLICY IF EXISTS "Users can update own activities" ON public.deal_activities;
CREATE POLICY "Users can update own activities"
ON public.deal_activities
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());