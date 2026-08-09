create or replace function public.operacional_incorporador_comissoes(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_comissao numeric := 74.55; -- 15% de R$ 497 (unidade de comissão MCF Pay)
  v_result jsonb;
begin
  with tx as (
    select t.id, t.sale_status, t.sale_date, t.updated_at, t.linked_deal_id
    from public.hubla_transactions t
    where t.product_name ilike 'A000%'
      and t.source = 'mcfpay'
      and (
        (t.sale_status = 'completed'
          and (t.sale_date at time zone 'America/Sao_Paulo')::date between p_from and p_to)
        or
        (t.sale_status = 'refunded'
          and (t.updated_at at time zone 'America/Sao_Paulo')::date between p_from and p_to)
      )
  ),
  codes as (
    select
      tx.id,
      tx.sale_status,
      coalesce(
        (select l.payload->>'closer_code' from public.mcf_pay_dispatch_logs l
          where l.deal_id = tx.linked_deal_id and l.payload->>'closer_code' is not null
          order by l.created_at desc limit 1),
        (select pr.mcf_pay_closer_code from public.crm_deals d
           join public.profiles pr on lower(pr.email) = lower(coalesce(d.r2_closer_email, d.r1_closer_email))
          where d.id = tx.linked_deal_id and pr.mcf_pay_closer_code is not null limit 1)
      ) as closer_code,
      coalesce(
        (select l.payload->>'sdr_code' from public.mcf_pay_dispatch_logs l
          where l.deal_id = tx.linked_deal_id and l.payload->>'sdr_code' is not null
          order by l.created_at desc limit 1),
        (select pr.mcf_pay_sdr_code
           from public.meeting_slot_attendees a
           join public.meeting_slots s on s.id = a.meeting_slot_id
           join public.profiles pr on pr.id = a.booked_by
          where a.deal_id = tx.linked_deal_id
            and s.meeting_type = 'r1'
            and pr.mcf_pay_sdr_code is not null
          order by s.scheduled_at asc limit 1)
      ) as sdr_code
    from tx
  ),
  closers as (
    select coalesce(closer_code, 'nao_atribuido') as k,
      count(*) filter (where sale_status = 'completed') as vendas_qtd,
      count(*) filter (where sale_status = 'refunded') as reembolsos_qtd
    from codes group by 1
  ),
  sdrs as (
    select coalesce(sdr_code, 'nao_atribuido') as k,
      count(*) filter (where sale_status = 'completed') as vendas_qtd,
      count(*) filter (where sale_status = 'refunded') as reembolsos_qtd
    from codes group by 1
  ),
  tot as (
    select
      count(*) filter (where sale_status = 'completed') as vendas_qtd,
      count(*) filter (where sale_status = 'refunded') as reembolsos_qtd
    from codes
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', p_from, 'ate', p_to, 'timezone', 'America/Sao_Paulo'),
    'criterios', jsonb_build_object(
      'produto', 'A000 - Contrato (source = mcfpay)',
      'vendas_ancora', 'sale_date no periodo',
      'reembolsos_ancora', 'updated_at no periodo (proxy da data do pedido de reembolso)',
      'comissao_unitaria', v_comissao,
      'atribuicao', 'codigo enviado no dispatch log; fallback = closer do slot / SDR que agendou a R1'
    ),
    'closers', coalesce((
      select jsonb_object_agg(k, jsonb_build_object(
        'vendas_qtd', vendas_qtd,
        'vendas_bruto', round(vendas_qtd * v_comissao, 2),
        'reembolsos_qtd', reembolsos_qtd,
        'reembolsos_valor', round(reembolsos_qtd * v_comissao, 2),
        'liquido', round((vendas_qtd - reembolsos_qtd) * v_comissao, 2)
      )) from closers), '{}'::jsonb),
    'sdrs', coalesce((
      select jsonb_object_agg(k, jsonb_build_object(
        'vendas_qtd', vendas_qtd,
        'vendas_bruto', round(vendas_qtd * v_comissao, 2),
        'reembolsos_qtd', reembolsos_qtd,
        'reembolsos_valor', round(reembolsos_qtd * v_comissao, 2),
        'liquido', round((vendas_qtd - reembolsos_qtd) * v_comissao, 2)
      )) from sdrs), '{}'::jsonb),
    'totais', (
      select jsonb_build_object(
        'vendas_qtd', vendas_qtd,
        'reembolsos_qtd', reembolsos_qtd,
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