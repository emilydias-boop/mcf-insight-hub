-- 1) Restaura o carimbo stage_moved_at do negócio usado como cobaia nos testes de trigger.
--    O stage_id já está correto (b5af7d28 = target_stage_id da regra de replicação),
--    mas o stage_moved_at ficou 11s adiantado por causa do move de teste.
UPDATE public.crm_deals
SET stage_moved_at = created_at
WHERE id = '6e6b4278-7ea8-4908-8722-f43c58ffc3ff'
  AND stage_moved_at = '2026-08-17 13:38:12.678627+00';

-- 2) log_generic_audit: NEW não é atribuído em trigger de DELETE, então
--    COALESCE(NEW.id, OLD.id) levantava "record new is not assigned yet"
--    e o EXCEPTION engolia — nenhuma exclusão era auditada.
CREATE OR REPLACE FUNCTION public.log_generic_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE public.redact_audit_snapshot(to_jsonb(OLD)) END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE public.redact_audit_snapshot(to_jsonb(NEW)) END
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END;
$function$;

-- 3) Teste em linha descartável (tabela temporária de teste, criada e destruída aqui).
DO $$
DECLARE v_id uuid := gen_random_uuid(); v_del int; v_ins int;
BEGIN
  CREATE TABLE public.zz_audit_probe (id uuid primary key, valor_credito numeric, cpf text);
  CREATE TRIGGER trg_probe AFTER INSERT OR UPDATE OR DELETE ON public.zz_audit_probe
    FOR EACH ROW EXECUTE FUNCTION public.log_generic_audit();

  INSERT INTO public.zz_audit_probe (id, valor_credito, cpf) VALUES (v_id, 123, '11122233344');
  DELETE FROM public.zz_audit_probe WHERE id = v_id;

  SELECT count(*) INTO v_ins FROM audit_logs WHERE table_name='zz_audit_probe' AND action='INSERT' AND record_id=v_id;
  SELECT count(*) INTO v_del FROM audit_logs WHERE table_name='zz_audit_probe' AND action='DELETE' AND record_id=v_id;
  RAISE NOTICE 'probe insert_logs=% delete_logs=%', v_ins, v_del;
  IF v_del <> 1 THEN RAISE EXCEPTION 'DELETE ainda não é auditado (linhas=%)', v_del; END IF;

  DELETE FROM audit_logs WHERE table_name='zz_audit_probe';
  DROP TABLE public.zz_audit_probe;
END $$;