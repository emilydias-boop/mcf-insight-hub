CREATE OR REPLACE FUNCTION public.pos_venda_reuniao_define_dono()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; g record; antigo text;
BEGIN
  SELECT id, owner_profile_id, owner_id INTO d FROM crm_deals
   WHERE id = NEW.deal_id AND origin_id = 'b05a0000-0000-4000-8000-000000000002';
  IF d.id IS NULL OR NEW.gerente_id IS NULL OR d.owner_profile_id = NEW.gerente_id THEN RETURN NULL; END IF;
  IF d.owner_profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pos_venda_distribuicao WHERE profile_id = d.owner_profile_id) THEN RETURN NULL; END IF;
  SELECT id, full_name, email INTO g FROM profiles WHERE id = NEW.gerente_id;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  SELECT full_name INTO antigo FROM profiles WHERE id = d.owner_profile_id;
  UPDATE crm_deals SET owner_profile_id = g.id, owner_id = g.email WHERE id = d.id;
  INSERT INTO deal_activities(deal_id, activity_type, description, metadata)
  VALUES (d.id, 'owner_change', 'Dono alterado de '||coalesce(antigo,'(sem dono)')||' para '||coalesce(g.full_name,'')||' pela reunião de viabilidade',
    jsonb_build_object('reuniao_id', NEW.id, 'de', d.owner_profile_id, 'para', g.id, 'origem', 'pos_venda_reuniao_define_dono'));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'pos_venda_reuniao_define_dono: %', SQLERRM; RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.pos_venda_reuniao_define_dono() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pos_venda_reuniao_define_dono ON public.pos_venda_reunioes;
CREATE TRIGGER trg_pos_venda_reuniao_define_dono AFTER INSERT OR UPDATE OF gerente_id ON public.pos_venda_reunioes
FOR EACH ROW EXECUTE FUNCTION public.pos_venda_reuniao_define_dono();

-- backfill: reaplica a última reunião de cada cartão elegível
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT ON (pr.deal_id) pr.* FROM pos_venda_reunioes pr
    JOIN crm_deals d ON d.id = pr.deal_id
   WHERE d.origin_id = 'b05a0000-0000-4000-8000-000000000002'
     AND (d.owner_profile_id IS NULL OR d.owner_profile_id IN (SELECT profile_id FROM pos_venda_distribuicao))
   ORDER BY pr.deal_id, pr.created_at DESC
  LOOP
    UPDATE pos_venda_reunioes SET gerente_id = gerente_id WHERE id = r.id;
  END LOOP;
END $$;