CREATE OR REPLACE FUNCTION public.tg_pending_reg_default_vendedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_name text;
BEGIN
  IF NEW.vendedor_id IS NULL AND NEW.deal_id IS NOT NULL THEN
    SELECT d.owner_id INTO v_owner FROM public.crm_deals d WHERE d.id = NEW.deal_id;
    IF v_owner IS NOT NULL THEN
      NEW.vendedor_id := v_owner;
      IF NEW.vendedor_name_cota IS NULL OR btrim(NEW.vendedor_name_cota) = '' THEN
        SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = v_owner;
        IF v_name IS NOT NULL AND btrim(v_name) <> '' THEN
          NEW.vendedor_name_cota := v_name;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_reg_default_vendedor ON public.consorcio_pending_registrations;
CREATE TRIGGER trg_pending_reg_default_vendedor
BEFORE INSERT ON public.consorcio_pending_registrations
FOR EACH ROW EXECUTE FUNCTION public.tg_pending_reg_default_vendedor();