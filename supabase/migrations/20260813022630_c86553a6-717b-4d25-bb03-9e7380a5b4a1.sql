CREATE OR REPLACE FUNCTION public.sync_employee_access_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desired text;
BEGIN
  -- Só reage a transições que envolvem 'desligado'
  IF NOT (NEW.status = 'desligado' OR OLD.status = 'desligado') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'desligado' THEN
    v_desired := 'desativado';
  ELSIF NEW.status = 'ativo' THEN
    v_desired := 'ativo';
  ELSE
    -- ex: desligado -> afastado/ferias: não reativa acesso automaticamente
    RETURN NEW;
  END IF;

  -- 1. Refletir no acesso (profiles) dos vínculos conhecidos
  UPDATE public.profiles p
     SET access_status = v_desired,
         updated_at = now()
   WHERE p.id IN (NEW.user_id, NEW.profile_id)
     AND p.access_status IS DISTINCT FROM v_desired
     AND p.access_status <> 'bloqueado';

  -- 2. Banir/desbanir de verdade no Supabase Auth (só possível via edge function)
  BEGIN
    PERFORM net.http_post(
      url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/sync-employee-access',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object(
        'employee_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'source', 'db_trigger'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_employee_access_on_status_change falhou: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_access_on_status_change ON public.employees;

CREATE TRIGGER trg_sync_employee_access_on_status_change
AFTER UPDATE OF status ON public.employees
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_employee_access_on_status_change();