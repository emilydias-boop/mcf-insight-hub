-- Reuniões piloto: derivadas na hora (entram e saem sozinhas)
create or replace function public.script_piloto_reunioes(_dias int default 120)
returns table(meeting_slot_id uuid, closer_id uuid, closer_nome text, closer_bu text, scheduled_at timestamptz,
  duracao_min int, participantes jsonb, pagos int, recording_id uuid, tem_transcricao boolean, nota_geral numeric, aderencia_pct numeric)
language sql stable security invoker set search_path = public as $$
  with base as (
    select s.id, s.closer_id, c.name, c.bu, s.scheduled_at, s.duration_minutes,
      jsonb_agg(jsonb_build_object('nome', a.attendee_name, 'status', a.status,
        'pago', ((a.status = 'contract_paid' or a.contract_paid_at is not null) and a.refunded_at is null))
        order by a.attendee_name) participantes,
      count(*) filter (where (a.status = 'contract_paid' or a.contract_paid_at is not null) and a.refunded_at is null)::int pagos
    from meeting_slots s
    join closers c on c.id = s.closer_id
    join meeting_slot_attendees a on a.meeting_slot_id = s.id
    where s.meeting_type = 'r1' and s.status = 'completed'
      and s.scheduled_at >= now() - make_interval(days => greatest(1, least(coalesce(_dias,120), 730)))
    group by s.id, s.closer_id, c.name, c.bu, s.scheduled_at, s.duration_minutes
  )
  select b.id, b.closer_id, b.name, b.bu, b.scheduled_at,
    coalesce(r.duration_minutes, b.duration_minutes), b.participantes, b.pagos,
    r.id, (r.id is not null), rv.nota_geral, rv.aderencia_pct
  from base b
  left join lateral (
    select mr.id, mr.duration_minutes from meeting_recordings mr
    where mr.meeting_slot_id = b.id and coalesce(mr.transcript_chars, 0) > 0
    order by mr.transcript_chars desc nulls last limit 1
  ) r on true
  left join lateral (
    select x.nota_geral, x.aderencia_pct from meeting_ai_reviews x
    where x.meeting_slot_id = b.id order by x.created_at desc limit 1
  ) rv on true
  where b.pagos between 2 and 3
  order by b.scheduled_at desc;
$$;
revoke all on function public.script_piloto_reunioes(int) from public, anon;
grant execute on function public.script_piloto_reunioes(int) to authenticated, service_role;

-- Saúde do script: taxa de contrato pago por faixa de nota
create or replace function public.script_saude_faixas(_meeting_type text default 'r1')
returns table(faixa text, ordem int, reunioes int, participantes int, contratos int, taxa_pct numeric)
language sql stable security invoker set search_path = public as $$
  with ult as (
    select distinct on (rv.meeting_slot_id) rv.meeting_slot_id, rv.nota_geral
    from meeting_ai_reviews rv
    where rv.meeting_type = _meeting_type and rv.meeting_slot_id is not null and rv.nota_geral is not null
    order by rv.meeting_slot_id, rv.created_at desc
  ), f as (
    select u.meeting_slot_id,
      case when u.nota_geral < 4 then 1 when u.nota_geral < 6 then 2 when u.nota_geral < 8 then 3 else 4 end o
    from ult u
  ), faixas(o, nome) as (values (1,'0–4'),(2,'4–6'),(3,'6–8'),(4,'8–10'))
  select fx.nome, fx.o,
    count(distinct f.meeting_slot_id)::int,
    count(a.id) filter (where a.status <> 'no_show')::int,
    count(a.id) filter (where (a.status = 'contract_paid' or a.contract_paid_at is not null) and a.refunded_at is null)::int,
    case when count(a.id) filter (where a.status <> 'no_show') > 0 then round(100.0 *
      count(a.id) filter (where (a.status = 'contract_paid' or a.contract_paid_at is not null) and a.refunded_at is null)
      / count(a.id) filter (where a.status <> 'no_show'), 1) end
  from faixas fx
  left join f on f.o = fx.o
  left join meeting_slot_attendees a on a.meeting_slot_id = f.meeting_slot_id
  group by fx.nome, fx.o order by fx.o;
$$;
revoke all on function public.script_saude_faixas(text) from public, anon;
grant execute on function public.script_saude_faixas(text) to authenticated, service_role;

-- Resumo semanal por closer (R1)
create or replace function public.resumo_semanal_closers(_inicio date, _fim date)
returns table(closer_id uuid, closer_nome text, bu text, reunioes_realizadas int, participantes_atendidos int, contratos_pagos int, conversao_pct numeric)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.bu,
    count(distinct s.id)::int,
    count(a.id) filter (where a.status <> 'no_show')::int,
    count(a.id) filter (where (a.status = 'contract_paid' or a.contract_paid_at is not null) and a.refunded_at is null)::int,
    case when count(a.id) filter (where a.status <> 'no_show') > 0 then round(100.0 *
      count(a.id) filter (where (a.status = 'contract_paid' or a.contract_paid_at is not null) and a.refunded_at is null)
      / count(a.id) filter (where a.status <> 'no_show'), 1) end
  from meeting_slots s
  join closers c on c.id = s.closer_id
  left join meeting_slot_attendees a on a.meeting_slot_id = s.id
  where s.meeting_type = 'r1' and s.status = 'completed'
    and (s.scheduled_at at time zone 'America/Sao_Paulo')::date between _inicio and _fim
  group by c.id, c.name, c.bu
  order by c.bu nulls last, c.name;
$$;
revoke all on function public.resumo_semanal_closers(date, date) from public, anon;
grant execute on function public.resumo_semanal_closers(date, date) to authenticated, service_role;

-- Registro dos envios (evita mandar a mesma semana duas vezes)
create table public.resumo_semanal_closers_envios (
  id uuid primary key default gen_random_uuid(),
  semana_inicio date not null,
  bu text not null,
  destinatarios text[] not null default '{}',
  status text not null default 'pendente',
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semana_inicio, bu)
);
grant select on public.resumo_semanal_closers_envios to authenticated;
grant all on public.resumo_semanal_closers_envios to service_role;
alter table public.resumo_semanal_closers_envios enable row level security;
create policy "admin e manager leem envios do resumo" on public.resumo_semanal_closers_envios
  for select to authenticated using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'manager'));