CREATE OR REPLACE FUNCTION public.resolve_deal_owner(_deal_id uuid)
 RETURNS TABLE(profile_id uuid, full_name text, first_name text, email text, telefone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _deal record;
  _stage_name text;
  _resolved_email text;
BEGIN
  SELECT d.owner_profile_id, d.owner_id, d.original_sdr_email,
         d.r1_closer_email, d.r2_closer_email, d.stage_id
    INTO _deal
  FROM public.crm_deals d
  WHERE d.id = _deal_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT s.stage_name INTO _stage_name
  FROM public.deal_stages s
  WHERE s.id = _deal.stage_id;

  IF _stage_name IN ('R2 Agendada', 'Contrato Pago') AND _deal.r2_closer_email IS NOT NULL THEN
    _resolved_email := lower(_deal.r2_closer_email);
  ELSIF _stage_name IN ('R1 Agendada', 'R1 Realizada', 'No-Show') AND _deal.r1_closer_email IS NOT NULL THEN
    _resolved_email := lower(_deal.r1_closer_email);
  ELSIF _deal.original_sdr_email IS NOT NULL THEN
    _resolved_email := lower(_deal.original_sdr_email);
  END IF;

  IF _resolved_email IS NOT NULL THEN
    RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      split_part(coalesce(p.full_name, ''), ' ', 1) AS first_name,
      p.email,
      public.normalize_owner_phone(e.telefone) AS telefone
    FROM public.profiles p
    LEFT JOIN public.employees e ON lower(e.email_pessoal) = lower(p.email)
    WHERE lower(p.email) = _resolved_email
    LIMIT 1;
  ELSIF _deal.owner_profile_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      split_part(coalesce(p.full_name, ''), ' ', 1) AS first_name,
      p.email,
      public.normalize_owner_phone(e.telefone) AS telefone
    FROM public.profiles p
    LEFT JOIN public.employees e ON lower(e.email_pessoal) = lower(p.email)
    WHERE p.id = _deal.owner_profile_id
    LIMIT 1;
  END IF;
END;
$function$;

-- Reprocessar itens que falharam por causa do bug
UPDATE public.automation_queue
SET status='pending', attempts=0, error_message=NULL, scheduled_at=now()
WHERE status='failed'
  AND flow_id='c4957cc5-a5bd-4e34-abea-bf3b77170d7c'
  AND created_at > now() - interval '12 hours';