CREATE OR REPLACE FUNCTION public.ar_create_from_hubla()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_tipo text;
  v_status text;
  v_titulo_id uuid;
  v_is_phantom boolean;
  v_ref numeric;
  v_valor_pago_total numeric;
  v_valor_pendente numeric;
  v_parcelas_extras int;
  v_valor_parcela numeric;
  v_soma numeric;
  v_valor_ultima numeric;
  v_venc_base date;
  v_venc date;
  v_valor_total_hubla numeric;
  i int;
BEGIN
  IF coalesce(NEW.sale_status,'') NOT IN ('completed','paid') THEN
    RETURN NEW;
  END IF;

  v_code := public.extract_product_code(NEW.product_name);
  IF v_code IS NULL OR NOT v_code = ANY(ARRAY['A001','A002','A003','A004','A005','A006','A007','A008','A009','A000']) THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;