-- Default responsável dos títulos A Receber = Bruna Carielo (financeiro)
-- Backfill: qualquer título sem responsável passa a ser da Bruna
UPDATE public.ar_titulos
SET responsavel_id = 'fdaa0467-9660-45a4-84ba-7e548306d6ad'
WHERE responsavel_id IS NULL;

-- Trigger: novos títulos sem responsável recebem Bruna automaticamente
CREATE OR REPLACE FUNCTION public.ar_titulos_set_default_responsavel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.responsavel_id IS NULL THEN
    NEW.responsavel_id := 'fdaa0467-9660-45a4-84ba-7e548306d6ad';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_titulos_default_responsavel ON public.ar_titulos;
CREATE TRIGGER trg_ar_titulos_default_responsavel
BEFORE INSERT ON public.ar_titulos
FOR EACH ROW EXECUTE FUNCTION public.ar_titulos_set_default_responsavel();