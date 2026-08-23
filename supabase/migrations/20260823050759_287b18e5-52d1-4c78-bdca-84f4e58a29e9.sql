CREATE OR REPLACE FUNCTION public.tg_pending_reg_default_vendedor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner text;
  v_name text;
  v_email text;
  v_vendedor uuid;
BEGIN
  BEGIN
    IF NEW.vendedor_id IS NULL AND NEW.deal_id IS NOT NULL THEN
      SELECT d.owner_id::text INTO v_owner FROM public.crm_deals d WHERE d.id = NEW.deal_id;

      IF v_owner IS NOT NULL AND btrim(v_owner) <> '' THEN
        -- owner_id guarda e-mail (text); aceita uuid por compatibilidade
        IF v_owner ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          SELECT p.full_name, p.email INTO v_name, v_email
          FROM public.profiles p WHERE p.id = v_owner::uuid LIMIT 1;
        ELSE
          SELECT p.full_name, p.email INTO v_name, v_email
          FROM public.profiles p WHERE lower(p.email) = lower(btrim(v_owner)) LIMIT 1;
        END IF;

        -- vendedor_id precisa ser um id de consorcio_vendedor_options (FK da cota)
        IF v_name IS NOT NULL AND btrim(v_name) <> '' THEN
          SELECT o.id INTO v_vendedor
          FROM public.consorcio_vendedor_options o
          WHERE lower(btrim(o.name)) = lower(btrim(v_name))
          LIMIT 1;
        END IF;

        IF v_vendedor IS NOT NULL THEN
          NEW.vendedor_id := v_vendedor;
        END IF;

        IF (NEW.vendedor_name_cota IS NULL OR btrim(NEW.vendedor_name_cota) = '')
           AND v_name IS NOT NULL AND btrim(v_name) <> '' THEN
          NEW.vendedor_name_cota := v_name;
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  RETURN NEW;
END;
$function$;