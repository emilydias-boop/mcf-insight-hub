CREATE OR REPLACE FUNCTION public.pos_venda_on_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_code text; v_msg text;
BEGIN
  BEGIN
    IF coalesce(NEW.sale_status,'') <> 'completed' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.sale_status = 'completed' THEN RETURN NEW; END IF;
    IF coalesce(NEW.is_offer,false) THEN RETURN NEW; END IF;
    IF coalesce(NEW.installment_number,1) > 1 THEN RETURN NEW; END IF;
    IF coalesce(NEW.net_value,0) < 0 THEN RETURN NEW; END IF;
    v_code := upper(substring(coalesce(NEW.product_name,'') from '(?i)^\s*([AR]00[1-9])'));
    IF v_code IS NULL AND coalesce(NEW.product_name,'') ~* 'renova' THEN v_code := 'A006'; END IF;
    IF coalesce(NEW.product_name,'') ~* 'renova' AND coalesce(v_code,'') <> 'A006' THEN RETURN NEW; END IF;
    IF v_code IS NULL OR v_code NOT IN ('A001','A003','A004','A005','A006','A009','R001','R002','R003','R004','R005','R009') THEN RETURN NEW; END IF;
    PERFORM pos_venda_registrar_cliente(NEW.customer_email, NEW.customer_phone, NEW.customer_name, v_code,
      NEW.product_name, coalesce(NEW.product_price, NEW.net_value), coalesce(NEW.sale_date, now()),
      coalesce(NEW.source,'hubla'), coalesce(NEW.hubla_id, NEW.id::text));
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    BEGIN INSERT INTO pos_venda_entrada_falhas (transacao_id, erro) VALUES (NEW.id, v_msg); EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE WARNING 'pos_venda_on_venda falhou (venda segue normal): %', v_msg;
  END;
  RETURN NEW;
END $function$;