-- 1. Tabela de histórico de cargo
CREATE TABLE IF NOT EXISTS public.employee_cargo_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cargo_catalogo_id UUID REFERENCES public.cargos_catalogo(id) ON DELETE SET NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  motivo TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_cargo_hist_emp ON public.employee_cargo_history(employee_id, valid_from);
CREATE INDEX IF NOT EXISTS idx_emp_cargo_hist_range ON public.employee_cargo_history(employee_id, valid_from, valid_to);

ALTER TABLE public.employee_cargo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/managers/RH podem ler histórico de cargo"
ON public.employee_cargo_history FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
  OR public.has_role(auth.uid(), 'assistente_administrativo'::app_role)
);

-- Service role faz tudo (edge functions)
CREATE POLICY "Service role manages cargo history"
ON public.employee_cargo_history FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. Trigger: ao mudar cargo_catalogo_id em employees, fecha histórico anterior e abre novo
CREATE OR REPLACE FUNCTION public.sync_employee_cargo_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_change_date DATE := CURRENT_DATE;
BEGIN
  -- Só age quando cargo_catalogo_id realmente muda
  IF TG_OP = 'UPDATE' AND NEW.cargo_catalogo_id IS DISTINCT FROM OLD.cargo_catalogo_id THEN
    -- Fecha o segmento aberto anterior (valid_to = ontem)
    UPDATE public.employee_cargo_history
    SET valid_to = v_change_date - INTERVAL '1 day'
    WHERE employee_id = NEW.id
      AND valid_to IS NULL;

    -- Abre novo segmento
    IF NEW.cargo_catalogo_id IS NOT NULL THEN
      INSERT INTO public.employee_cargo_history (employee_id, cargo_catalogo_id, valid_from, motivo)
      VALUES (NEW.id, NEW.cargo_catalogo_id, v_change_date, 'Mudança automática via UPDATE em employees');
    END IF;
  END IF;

  -- Em INSERT com cargo, garante segmento inicial
  IF TG_OP = 'INSERT' AND NEW.cargo_catalogo_id IS NOT NULL THEN
    INSERT INTO public.employee_cargo_history (employee_id, cargo_catalogo_id, valid_from, motivo)
    VALUES (NEW.id, NEW.cargo_catalogo_id, COALESCE(NEW.data_admissao, CURRENT_DATE), 'Cargo inicial')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_cargo_history ON public.employees;
CREATE TRIGGER trg_sync_employee_cargo_history
AFTER INSERT OR UPDATE OF cargo_catalogo_id ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_cargo_history();

-- 3. Backfill: para cada employee com cargo_catalogo_id, criar segmento aberto a partir de data_admissao
INSERT INTO public.employee_cargo_history (employee_id, cargo_catalogo_id, valid_from, motivo)
SELECT
  e.id,
  e.cargo_catalogo_id,
  COALESCE(e.data_admissao, '2020-01-01'::date),
  'Backfill cargo atual'
FROM public.employees e
WHERE e.cargo_catalogo_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.employee_cargo_history h WHERE h.employee_id = e.id
  );

-- 4. Backfill específico Cristiane Gomes (07ca8150-5a9d-4be6-8bba-bb1bcd2b169d):
-- Era Closer Inside N1 até 13/04/2026, virou Gerente de Contas Inside em 14/04/2026.
-- Limpa histórico atual dela e recria com os dois segmentos.
DO $$
DECLARE
  v_emp_id UUID := '07ca8150-5a9d-4be6-8bba-bb1bcd2b169d';
  v_cargo_atual UUID;
  v_cargo_closer UUID;
BEGIN
  -- cargo atual da Cris (Gerente de Contas Inside)
  SELECT cargo_catalogo_id INTO v_cargo_atual FROM public.employees WHERE id = v_emp_id;
  -- localiza Closer Inside N1
  SELECT id INTO v_cargo_closer
  FROM public.cargos_catalogo
  WHERE nome_exibicao ILIKE 'Closer Inside%N1%'
  ORDER BY nivel NULLS LAST
  LIMIT 1;

  IF v_cargo_atual IS NOT NULL AND v_cargo_closer IS NOT NULL THEN
    DELETE FROM public.employee_cargo_history WHERE employee_id = v_emp_id;

    INSERT INTO public.employee_cargo_history (employee_id, cargo_catalogo_id, valid_from, valid_to, motivo)
    VALUES
      (v_emp_id, v_cargo_closer, '2024-01-01'::date, '2026-04-13'::date, 'Backfill: cargo anterior (Closer Inside N1)'),
      (v_emp_id, v_cargo_atual, '2026-04-14'::date, NULL, 'Backfill: mudança para Gerente de Contas Inside');
  END IF;
END $$;

-- 5. Coluna de segmentos no payout (auditoria)
ALTER TABLE public.sdr_month_payout
  ADD COLUMN IF NOT EXISTS cargo_segments JSONB;

COMMENT ON COLUMN public.sdr_month_payout.cargo_segments IS
'Quebra do mês por cargo quando há mudança no meio do mês. Array de {cargo_catalogo_id, cargo_nome, valid_from, valid_to, dias_uteis, ratio, fixo, ote, ifood}';