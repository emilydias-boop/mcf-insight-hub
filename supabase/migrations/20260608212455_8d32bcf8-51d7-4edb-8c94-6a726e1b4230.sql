CREATE OR REPLACE FUNCTION public.sync_employee_cargo_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_change_date DATE := CURRENT_DATE;
  v_skip TEXT;
BEGIN
  -- Permite que a edge function de mudança retroativa suprima este trigger
  BEGIN
    v_skip := current_setting('app.skip_cargo_history_trigger', true);
  EXCEPTION WHEN OTHERS THEN
    v_skip := NULL;
  END;
  IF v_skip = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.cargo_catalogo_id IS DISTINCT FROM OLD.cargo_catalogo_id THEN
    UPDATE public.employee_cargo_history
    SET valid_to = v_change_date - INTERVAL '1 day'
    WHERE employee_id = NEW.id
      AND valid_to IS NULL;

    IF NEW.cargo_catalogo_id IS NOT NULL THEN
      INSERT INTO public.employee_cargo_history (employee_id, cargo_catalogo_id, valid_from, motivo)
      VALUES (NEW.id, NEW.cargo_catalogo_id, v_change_date, 'Mudança automática via UPDATE em employees');
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.cargo_catalogo_id IS NOT NULL THEN
    INSERT INTO public.employee_cargo_history (employee_id, cargo_catalogo_id, valid_from, motivo)
    VALUES (NEW.id, NEW.cargo_catalogo_id, COALESCE(NEW.data_admissao, CURRENT_DATE), 'Cargo inicial')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;