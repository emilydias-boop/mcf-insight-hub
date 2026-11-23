CREATE OR REPLACE FUNCTION public.pos_venda_marcar_renovacao()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.origin_id = 'b05a0000-0000-4000-8000-000000000002'
     AND NOT ('Renovação de Parceria' = ANY(coalesce(NEW.tags,'{}')))
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(NEW.custom_fields->'pos_venda_compras','[]'::jsonb)) c
                 WHERE c->>'produto_codigo' IN ('A006','A009') OR coalesce(c->>'produto','') ~* 'renova') THEN
    NEW.tags := coalesce(NEW.tags,'{}') || ARRAY['Renovação de Parceria'];
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pos_venda_marcar_renovacao ON public.crm_deals;
CREATE TRIGGER trg_pos_venda_marcar_renovacao BEFORE INSERT OR UPDATE OF custom_fields, tags ON public.crm_deals
FOR EACH ROW WHEN (NEW.origin_id = 'b05a0000-0000-4000-8000-000000000002')
EXECUTE FUNCTION public.pos_venda_marcar_renovacao();

UPDATE public.crm_deals d SET tags = coalesce(tags,'{}') || ARRAY['Renovação de Parceria']
WHERE origin_id = 'b05a0000-0000-4000-8000-000000000002'
  AND NOT ('Renovação de Parceria' = ANY(coalesce(tags,'{}')))
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(d.custom_fields->'pos_venda_compras','[]'::jsonb)) c
              WHERE c->>'produto_codigo' IN ('A006','A009') OR coalesce(c->>'produto','') ~* 'renova');

DO $$
DECLARE r jsonb; v uuid;
BEGIN
  r := public.pos_venda_registrar_cliente('jonnathan.oliveira.14.eng@gmail.com','+5598981164995','JONNATHAN SOUSA DE OLIVEIRA',
    'A009','A009 - Renovação Parceiro MCF',870,'2026-11-16 17:48:00+00','kiwify','kiwify_35b1dfbc-594c-4b39-bf61-ff76b7880eb8');
  v := (r->>'deal_id')::uuid;
  UPDATE public.crm_deals SET name='JONNATHAN SOUSA DE OLIVEIRA',
    custom_fields = custom_fields || jsonb_build_object('cpf','04594626360','whatsapp','98981164995')
  WHERE id = v;
  RAISE NOTICE '%', r;
END $$;