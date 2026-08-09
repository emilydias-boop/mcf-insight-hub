CREATE TABLE public.mcf_pay_commission_rates (
  code text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('closer','sdr')),
  rate numeric NOT NULL DEFAULT 0.15,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mcf_pay_commission_rates TO authenticated;
GRANT ALL ON public.mcf_pay_commission_rates TO service_role;

ALTER TABLE public.mcf_pay_commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read commission rates"
ON public.mcf_pay_commission_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage commission rates"
ON public.mcf_pay_commission_rates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_mcf_pay_commission_rates_updated_at
BEFORE UPDATE ON public.mcf_pay_commission_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.operacional_incorporador_comissoes(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_default_rate numeric := 0.15;
  v_result jsonb;
begin
  with vendas as (
    select t.id::text as ref_id,
           t.linked_deal_id as deal_id,
           'venda'::text as kind,
           coalesce(nullif(t.product_price, 0), t.net_value, 497) as base_valor
    from public.hubla_transactions t
    where t.product_name ilike 'A000%'
      and t.source = 'mcfpay'
      and (t.sale_date at time zone 'America/Sao_Paulo')::date between p_from and p_to
  ),
  reembolsos as (
    select distinct on (a.deal_id)
           a.id::text as ref_id,
           a.deal_id::uuid as deal_id,
           'reembolso'::text as kind,
           coalesce(
             (select coalesce(nullif(t2.product_price, 0), t2.net_value)
                from public.hubla_transactions t2
               where t2.linked_deal_id = a.deal_id::uuid
                 and t2.product_name ilike 'A000%'
                 and t2.source = 'mcfpay'
               order by t2.sale_date desc limit 1),
             (a.metadata->>'amount')::numeric
           ) as base_valor
    from public.deal_activities a
    where a.activity_type = 'refund_mcf_pay'
      and (a.metadata->>'amount')::numeric = 497
      and (a.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
      and a.deal_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    order by a.deal_id, a.created_at asc
  ),
  base as (
    select * from vendas union all select * from reembolsos
  ),
  codes as (
    select
      base.kind,
      base.base_valor,
      coalesce(
        (select l.payload->>'closer_code' from public.mcf_pay_dispatch_logs l
          where l.deal_id = base.deal_id and l.payload->>'closer_code' is not null
          order by l.created_at desc limit 1),
        (select pr.mcf_pay_closer_code from public.crm_deals d
           join public.profiles pr on lower(pr.email) = lower(coalesce(d.r2_closer_email, d.r1_closer_email))
          where d.id = base.deal_id and pr.mcf_pay_closer_code is not null limit 1)
      ) as closer_code,
      coalesce(
        (select l.payload->>'sdr_code' from public.mcf_pay_dispatch_logs l
          where l.deal_id = base.deal_id and l.payload->>'sdr_code' is not null
          order by l.created_at desc limit 1),
        (select pr.mcf_pay_sdr_code
           from public.meeting_slot_attendees a2
           join public.meeting_slots s on s.id = a2.meeting_slot_id
           join public.profiles pr on pr.id = a2.booked_by
          where a2.deal_id = base.deal_id
            and s.meeting_type = 'r1'
            and pr.mcf_pay_sdr_code is not null
          order by s.scheduled_at asc limit 1)
      ) as sdr_code
    from base
  ),
  closers as (
    select coalesce(c.closer_code, 'nao_atribuido') as k,
      coalesce(max(r.rate), v_default_rate) as rate,
      count(*) filter (where c.kind = 'venda') as vendas_qtd,
      count(*) filter (where c.kind = 'reembolso') as reembolsos_qtd,
      sum(c.base_valor * coalesce(r.rate, v_default_rate)) filter (where c.kind = 'venda') as bruto,
      sum(c.base_valor * coalesce(r.rate, v_default_rate)) filter (where c.kind = 'reembolso') as reemb
    from codes c
    left join public.mcf_pay_commission_rates r on r.role = 'closer' and r.code = c.closer_code
    group by 1
  ),
  sdrs as (
    select coalesce(c.sdr_code, 'nao_atribuido') as k,
      coalesce(max(r.rate), v_default_rate) as rate,
      count(*) filter (where c.kind = 'venda') as vendas_qtd,
      count(*) filter (where c.kind = 'reembolso') as reembolsos_qtd,
      sum(c.base_valor * coalesce(r.rate, v_default_rate)) filter (where c.kind = 'venda') as bruto,
      sum(c.base_valor * coalesce(r.rate, v_default_rate)) filter (where c.kind = 'reembolso') as reemb
    from codes c
    left join public.mcf_pay_commission_rates r on r.role = 'sdr' and r.code = c.sdr_code
    group by 1
  ),
  tot as (
    select
      count(*) filter (where kind = 'venda') as vendas_qtd,
      count(*) filter (where kind = 'reembolso') as reembolsos_qtd
    from codes
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', p_from, 'ate', p_to, 'timezone', 'America/Sao_Paulo'),
    'criterios', jsonb_build_object(
      'produto', 'A000 - Contrato (source = mcfpay)',
      'vendas_ancora', 'sale_date no periodo (inclui vendas reembolsadas depois = bruto MCF Pay)',
      'reembolsos_ancora', 'data do pedido de reembolso (deal_activities.refund_mcf_pay, valor 497)',
      'base_calculo', 'valor real da transacao (product_price, fallback net_value) x taxa da pessoa',
      'taxa_padrao', v_default_rate,
      'taxas_fonte', 'public.mcf_pay_commission_rates (15% ou 16% por codigo)',
      'atribuicao', 'codigo enviado no dispatch log; fallback = closer do slot / SDR que agendou a R1'
    ),
    'closers', coalesce((
      select jsonb_object_agg(k, jsonb_build_object(
        'taxa', rate,
        'vendas_qtd', vendas_qtd,
        'vendas_bruto', round(coalesce(bruto, 0), 2),
        'reembolsos_qtd', reembolsos_qtd,
        'reembolsos_valor', round(coalesce(reemb, 0), 2),
        'vendas_liquidas_qtd', vendas_qtd - reembolsos_qtd,
        'liquido', round(coalesce(bruto, 0) - coalesce(reemb, 0), 2)
      )) from closers), '{}'::jsonb),
    'sdrs', coalesce((
      select jsonb_object_agg(k, jsonb_build_object(
        'taxa', rate,
        'vendas_qtd', vendas_qtd,
        'vendas_bruto', round(coalesce(bruto, 0), 2),
        'reembolsos_qtd', reembolsos_qtd,
        'reembolsos_valor', round(coalesce(reemb, 0), 2),
        'vendas_liquidas_qtd', vendas_qtd - reembolsos_qtd,
        'liquido', round(coalesce(bruto, 0) - coalesce(reemb, 0), 2)
      )) from sdrs), '{}'::jsonb),
    'totais', jsonb_build_object(
      'vendas_qtd', (select vendas_qtd from tot),
      'reembolsos_qtd', (select reembolsos_qtd from tot),
      'vendas_liquidas_qtd', (select vendas_qtd - reembolsos_qtd from tot),
      'bruto', (select round(coalesce(sum(coalesce(bruto,0)), 0), 2) from closers),
      'reembolsos_valor', (select round(coalesce(sum(coalesce(reemb,0)), 0), 2) from closers),
      'liquido', (select round(coalesce(sum(coalesce(bruto,0) - coalesce(reemb,0)), 0), 2) from closers)
    )
  ) into v_result;

  return v_result;
end;
$function$;