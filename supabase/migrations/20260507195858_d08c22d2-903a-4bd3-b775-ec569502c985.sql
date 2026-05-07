CREATE OR REPLACE FUNCTION public.auto_move_deal_to_em_contato(
  p_deal_id uuid,
  p_source text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_em_contato uuid := 'b1c0a7e2-9d4f-4a1c-8e3b-2f5d6a8b9c01';
  v_allowed uuid[] := ARRAY[
    'e6fab26d-f16d-4b00-900f-ca915cbfe9d9'::uuid,
    'd346320a-00b0-4e9f-89b6-149ad1c34061'::uuid,
    '3c81d73b-0d5d-480f-a3c9-ab7a6c7965a2'::uuid,
    'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b'::uuid,
    'a1d19874-4d47-4405-94fd-fb5237da44dd'::uuid,
    'b06c9413-0312-4f1d-89b4-822d79bc6a90'::uuid
  ];
  v_current uuid;
  v_owner uuid;
BEGIN
  IF p_deal_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT stage_id, owner_id INTO v_current, v_owner FROM public.crm_deals WHERE id = p_deal_id;
  IF v_current IS NULL OR NOT (v_current = ANY(v_allowed)) THEN
    RETURN false;
  END IF;
  UPDATE public.crm_deals
    SET stage_id = v_em_contato, updated_at = now()
    WHERE id = p_deal_id;
  INSERT INTO public.deal_activities (deal_id, activity_type, description, from_stage, to_stage, user_id, metadata)
  VALUES (
    p_deal_id,
    'stage_change',
    COALESCE(p_description, format('Movido automaticamente para "Em contato" — contato via %s', p_source)),
    v_current,
    v_em_contato,
    v_owner,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('source', p_source, 'auto', true)
  );
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_move_deal_to_em_contato(uuid, text, text, jsonb) TO authenticated, service_role, anon;