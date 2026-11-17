CREATE OR REPLACE FUNCTION public.pos_venda_reuniao_define_dono()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d record; g record; antigo text;
BEGIN
  IF NEW.status = 'cancelada' THEN RETURN NULL; END IF;
  SELECT id, owner_profile_id, owner_id INTO d FROM crm_deals
   WHERE id = NEW.deal_id AND origin_id = 'b05a0000-0000-4000-8000-000000000002' FOR UPDATE;
  IF d.id IS NULL OR NEW.gerente_id IS NULL OR d.owner_profile_id = NEW.gerente_id THEN RETURN NULL; END IF;
  SELECT id, full_name, email INTO g FROM profiles WHERE id = NEW.gerente_id;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  SELECT full_name INTO antigo FROM profiles WHERE id = d.owner_profile_id;
  UPDATE crm_deals SET owner_profile_id = g.id, owner_id = g.email WHERE id = d.id;
  INSERT INTO deal_activities(deal_id, activity_type, description, metadata)
  VALUES (d.id, 'owner_change', 'Dono alterado de '||coalesce(antigo,'(sem dono)')||' para '||coalesce(g.full_name,'')||' pela reunião de viabilidade',
    jsonb_build_object('reuniao_id', NEW.id, 'de', d.owner_profile_id, 'para', g.id, 'origem', 'pos_venda_reuniao_define_dono'));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'pos_venda_reuniao_define_dono: %', SQLERRM; RETURN NULL;
END $function$;
UPDATE public.crm_deals d SET owner_profile_id = r.gerente_id, owner_id = p.email
FROM public.pos_venda_reunioes r JOIN public.profiles p ON p.id=r.gerente_id
WHERE d.id='3edbe4cb-75a2-48f1-97ff-7efae9c803d5' AND d.origin_id='b05a0000-0000-4000-8000-000000000002'
AND r.deal_id=d.id AND r.inicio='2026-11-20 17:30:00+00' AND r.status='agendada'
AND d.owner_profile_id IS DISTINCT FROM r.gerente_id;