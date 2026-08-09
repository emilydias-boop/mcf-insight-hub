create or replace function public.operacional_incorporador_comissoes(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_comissao numeric := 74.55;
  v_result jsonb;
begin
  with vendas as (
    select t.id::text as ref_id, t.linked_deal_id as deal_id, 'venda'::text as kind
    from public.hubla_transactions t
    where t.product_name ilike 'A000%'
      and t.source = 'mcfpay'
      and (t.sale_date at time zone 'America/Sao_Paulo')::date between p_from and p_to
  ),
  reembolsos as (
    select distinct on (a.deal_id) a.id::text as ref_id, a.deal_id::uuid as deal_id, 'reembolso'::text as kind
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
    select coalesce(closer_code, 'nao_atribuido') as k,
      count(*) filter (where kind = 'venda') as vendas_qtd,
      count(*) filter (where kind = 'reembolso') as reembolsos_qtd
    from codes group by 1
  ),
  sdrs as (
    select coalesce(sdr_code, 'nao_atribuido') as k,
      count(*) filter (where kind = 'venda') as vendas_qtd,
      count(*) filter (where kind = 'reembolso') as reembolsos_qtd
    from codes group by 1
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
      'comissao_unitaria', v_comissao,
      'atribuicao', 'codigo enviado no dispatch log; fallback = closer do slot / SDR que agendou a R1'
    ),
    'closers', coalesce((
      select jsonb_object_agg(k, jsonb_build_object(
        'vendas_qtd', vendas_qtd,
        'vendas_bruto', round(vendas_qtd * v_comissao, 2),
        'reembolsos_qtd', reembolsos_qtd,
        'reembolsos_valor', round(reembolsos_qtd * v_comissao, 2),
        'vendas_liquidas_qtd', vendas_qtd - reembolsos_qtd,
        'liquido', round((vendas_qtd - reembolsos_qtd) * v_comissao, 2)
      )) from closers), '{}'::jsonb),
    'sdrs', coalesce((
      select jsonb_object_agg(k, jsonb_build_object(
        'vendas_qtd', vendas_qtd,
        'vendas_bruto', round(vendas_qtd * v_comissao, 2),
        'reembolsos_qtd', reembolsos_qtd,
        'reembolsos_valor', round(reembolsos_qtd * v_comissao, 2),
        'vendas_liquidas_qtd', vendas_qtd - reembolsos_qtd,
        'liquido', round((vendas_qtd - reembolsos_qtd) * v_comissao, 2)
      )) from sdrs), '{}'::jsonb),
    'totais', (
      select jsonb_build_object(
        'vendas_qtd', vendas_qtd,
        'reembolsos_qtd', reembolsos_qtd,
        'vendas_liquidas_qtd', vendas_qtd - reembolsos_qtd,
        'bruto', round(vendas_qtd * v_comissao, 2),
        'liquido', round((vendas_qtd - reembolsos_qtd) * v_comissao, 2)
      ) from tot
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.operacional_incorporador_comissoes(date, date) from public;
grant execute on function public.operacional_incorporador_comissoes(date, date) to service_role;