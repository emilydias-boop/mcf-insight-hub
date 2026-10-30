
create table public.presenca_config_bu (
  bu text primary key check (bu in ('incorporador','consorcio')),
  lider_profile_id uuid references public.profiles(id),
  reunioes_por_closer integer not null,
  leads_por_reuniao integer not null,
  horario_corte time not null default '11:00',
  horario_aviso time not null default '10:45',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.presenca_config_bu to authenticated;
grant all on public.presenca_config_bu to service_role;
alter table public.presenca_config_bu enable row level security;

create table public.presenca_config_pessoas (
  id uuid primary key default gen_random_uuid(),
  bu text check (bu is null or bu in ('incorporador','consorcio')),
  tipo text check (tipo is null or tipo in ('closer','sdr')),
  profile_id uuid not null references public.profiles(id),
  regra text not null check (regra in ('fora_da_conta','saiu')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.presenca_config_pessoas to authenticated;
grant all on public.presenca_config_pessoas to service_role;
alter table public.presenca_config_pessoas enable row level security;

create table public.presenca_correcoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  bu text not null check (bu in ('incorporador','consorcio')),
  tipo text not null check (tipo in ('closer','sdr')),
  profile_id uuid not null references public.profiles(id),
  presente boolean not null,
  motivo text not null check (length(btrim(motivo)) > 0),
  corrigido_por uuid default auth.uid(),
  corrigido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data, bu, tipo, profile_id)
);
grant select, insert, update, delete on public.presenca_correcoes to authenticated;
grant all on public.presenca_correcoes to service_role;
alter table public.presenca_correcoes enable row level security;

create table public.presenca_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  bu text not null check (bu in ('incorporador','consorcio')),
  confirmado_por uuid default auth.uid(),
  confirmado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data, bu)
);
grant select, insert, update, delete on public.presenca_confirmacoes to authenticated;
grant all on public.presenca_confirmacoes to service_role;
alter table public.presenca_confirmacoes enable row level security;

create or replace function public.presenca_touch_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
create trigger trg_presenca_config_bu_upd before update on public.presenca_config_bu for each row execute function public.presenca_touch_updated_at();
create trigger trg_presenca_config_pessoas_upd before update on public.presenca_config_pessoas for each row execute function public.presenca_touch_updated_at();
create trigger trg_presenca_correcoes_upd before update on public.presenca_correcoes for each row execute function public.presenca_touch_updated_at();
create trigger trg_presenca_confirmacoes_upd before update on public.presenca_confirmacoes for each row execute function public.presenca_touch_updated_at();

create or replace function public.presenca_e_lider(p_bu text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from presenca_config_bu where bu = p_bu and lider_profile_id = auth.uid())
$$;
create or replace function public.presenca_pode_ver(p_bu text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.role(), '') = 'service_role'
      or public.has_role(auth.uid(), 'admin'::app_role)
      or public.presenca_e_lider(p_bu)
$$;
grant execute on function public.presenca_e_lider(text) to authenticated, service_role;
grant execute on function public.presenca_pode_ver(text) to authenticated, service_role;

create policy "presenca_config_bu ler" on public.presenca_config_bu for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or lider_profile_id = auth.uid());
create policy "presenca_config_bu admin grava" on public.presenca_config_bu for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));

create policy "presenca_config_pessoas ler" on public.presenca_config_pessoas for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)
         or exists (select 1 from presenca_config_bu c where c.lider_profile_id = auth.uid() and (presenca_config_pessoas.bu is null or c.bu = presenca_config_pessoas.bu)));
create policy "presenca_config_pessoas admin grava" on public.presenca_config_pessoas for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));

create policy "presenca_correcoes lider ou admin" on public.presenca_correcoes for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.presenca_e_lider(bu))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.presenca_e_lider(bu));
create policy "presenca_confirmacoes lider ou admin" on public.presenca_confirmacoes for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.presenca_e_lider(bu))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.presenca_e_lider(bu));

insert into public.presenca_config_bu (bu, lider_profile_id, reunioes_por_closer, leads_por_reuniao) values
  ('incorporador', 'a6802c50-1b85-4646-b20e-f40ae89c3157', 6, 3),
  ('consorcio',    'a6802c50-1b85-4646-b20e-f40ae89c3157', 7, 1);

insert into public.presenca_config_pessoas (bu, tipo, profile_id, regra, observacao) values
  (null, null, 'a6802c50-1b85-4646-b20e-f40ae89c3157', 'fora_da_conta', 'Jéssica Bellini (líder) fora das contas por decisão do CEO'),
  (null, null, '7aa935e2-73e1-4624-b189-aa9784e29485', 'fora_da_conta', 'Nicola Ricci fora das contas por decisão do CEO'),
  ('consorcio', 'closer', '8e66266d-6436-4481-903b-943b994acecd', 'fora_da_conta', 'João Pedro Martins Vieira conta só no Incorporador'),
  ('consorcio', 'closer', 'a15cb111-8831-4146-892a-d61ca674628a', 'fora_da_conta', 'Thobson: closer do Consórcio sem tipo de reunião'),
  (null, null, '0987bd2a-858f-4cca-af3c-2673a88701b6', 'saiu', 'Leonardo Lemos saiu da empresa');

-- Pessoas da BU no dia (interna; usada pelas funções abaixo).
create or replace function public._presenca_pessoas(p_data date, p_bu text)
returns table (
  tipo text, pessoa_id uuid, profile_id uuid, nome text, papel text, meta integer,
  primeiro_acesso timestamptz, presente_login boolean,
  corr_presente boolean, corr_motivo text, corr_por uuid, corr_em timestamptz,
  presente boolean, origem text, regra text, conta boolean
)
language sql stable security definer set search_path = public as $$
  with cfg as (
    select (p_data::timestamp at time zone 'America/Sao_Paulo') as t0,
           ((p_data + coalesce(c.horario_corte, time '11:00'))::timestamp at time zone 'America/Sao_Paulo') + interval '1 minute' as tc
    from (select 1) x left join presenca_config_bu c on c.bu = p_bu
  ),
  base as (
    select 'closer'::text tipo, c.id pessoa_id, pr.id profile_id, btrim(c.name) nome,
           case c.meeting_type when 'r1' then 'closer_r1' when 'r2' then 'closer_r2' else 'closer' end papel,
           null::integer meta
    from closers c
    left join lateral (select p.id from profiles p where lower(p.email) = lower(c.email) order by p.id limit 1) pr on true
    where c.is_active and c.bu = p_bu
    union all
    select 'sdr', s.id, s.user_id, btrim(s.name), 'sdr',
           coalesce((select m.meta_diaria from sdr_metas_mes m where m.sdr_id = s.id and m.ano_mes = to_char(p_data, 'YYYY-MM') limit 1), s.meta_diaria)
    from sdr s where s.active and s.squad = p_bu and s.role_type = 'sdr'
  ),
  enr as (
    select b.*,
      (select min(l.created_at) from page_access_log l, cfg where l.user_id = b.profile_id and l.created_at >= cfg.t0 and l.created_at < cfg.tc) primeiro_acesso,
      (select r.regra from presenca_config_pessoas r
        where r.profile_id = b.profile_id and (r.bu is null or r.bu = p_bu) and (r.tipo is null or r.tipo = b.tipo)
        order by case r.regra when 'saiu' then 0 else 1 end limit 1) regra,
      k.presente corr_presente, k.motivo corr_motivo, k.corrigido_por corr_por, k.corrigido_em corr_em
    from base b
    left join presenca_correcoes k on k.data = p_data and k.bu = p_bu and k.tipo = b.tipo and k.profile_id = b.profile_id
  )
  select tipo, pessoa_id, profile_id, nome, papel, meta,
         primeiro_acesso, primeiro_acesso is not null,
         corr_presente, corr_motivo, corr_por, corr_em,
         coalesce(corr_presente, primeiro_acesso is not null),
         case when corr_presente is not null then 'corrigido_lider' else 'login' end,
         regra,
         regra is null and papel in ('closer_r1','sdr')
  from enr
$$;
revoke all on function public._presenca_pessoas(date, text) from public, anon, authenticated;
grant execute on function public._presenca_pessoas(date, text) to service_role;

-- Lista para a tela "Presença do dia".
create or replace function public.presenca_lista_dia(p_data date, p_bu text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.presenca_pode_ver(p_bu) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'tipo', p.tipo, 'pessoa_id', p.pessoa_id, 'profile_id', p.profile_id, 'nome', p.nome, 'papel', p.papel,
      'meta', p.meta, 'primeiro_acesso', to_char(p.primeiro_acesso at time zone 'America/Sao_Paulo', 'HH24:MI'),
      'presente_login', p.presente_login, 'presente', p.presente, 'origem', p.origem,
      'motivo', p.corr_motivo, 'corrigido_em', p.corr_em, 'conta', p.conta, 'regra', p.regra
    ) order by p.tipo, p.nome)
    from public._presenca_pessoas(p_data, p_bu) p
    where coalesce(p.regra, '') <> 'saiu' and p.papel in ('closer_r1','sdr')
  ), '[]'::jsonb);
end $$;
revoke all on function public.presenca_lista_dia(date, text) from public, anon;
grant execute on function public.presenca_lista_dia(date, text) to authenticated, service_role;

-- Capacidade do dia (somente leitura).
create or replace function public.capacidade_dia(p_data date, p_bu text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cfg presenca_config_bu;
  v_t0 timestamptz := p_data::timestamp at time zone 'America/Sao_Paulo';
  v_t1 timestamptz := (p_data + 1)::timestamp at time zone 'America/Sao_Paulo';
  v jsonb;
begin
  if p_bu not in ('incorporador','consorcio') then raise exception 'BU inválida' using errcode = '22023'; end if;
  if not public.presenca_pode_ver(p_bu) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select * into v_cfg from presenca_config_bu where bu = p_bu;

  with p as (select * from public._presenca_pessoas(p_data, p_bu)),
  pj as (
    select p.*, jsonb_build_object('id', p.pessoa_id, 'nome', p.nome, 'origem', p.origem,
      'primeiro_acesso', to_char(p.primeiro_acesso at time zone 'America/Sao_Paulo', 'HH24:MI'),
      'motivo', p.corr_motivo, 'meta', p.meta) j
    from p
  ),
  bu_closers as (select id from closers where bu = p_bu),
  slots as (
    select ms.id from meeting_slots ms
    where ms.meeting_type = 'r1' and ms.closer_id in (select id from bu_closers)
      and ms.scheduled_at >= v_t0 and ms.scheduled_at < v_t1
      and ms.status not in ('cancelled','canceled')
  ),
  feitos as (
    select a.id, a.parent_attendee_id from meeting_slot_attendees a join meeting_slots ms on ms.id = a.meeting_slot_id
    where ms.meeting_type = 'r1' and ms.closer_id in (select id from bu_closers)
      and coalesce(a.is_partner, false) = false
      and coalesce(a.booked_at, a.created_at) >= v_t0 and coalesce(a.booked_at, a.created_at) < v_t1
  )
  select jsonb_build_object(
    'data', p_data, 'bu', p_bu,
    'regras', jsonb_build_object('reunioes_por_closer', v_cfg.reunioes_por_closer, 'leads_por_reuniao', v_cfg.leads_por_reuniao,
                                 'horario_corte', to_char(v_cfg.horario_corte, 'HH24:MI'), 'tipo_reuniao', 'R1'),
    'closers_ativos', (select count(*) from pj where tipo = 'closer' and conta),
    'closers_presentes', coalesce((select jsonb_agg(j order by nome) from pj where tipo = 'closer' and conta and presente), '[]'),
    'closers_ausentes', coalesce((select jsonb_agg(j order by nome) from pj where tipo = 'closer' and conta and not presente), '[]'),
    'reunioes_possiveis', (select count(*) from pj where tipo = 'closer' and conta and presente) * v_cfg.reunioes_por_closer,
    'leads_possiveis', (select count(*) from pj where tipo = 'closer' and conta and presente) * v_cfg.reunioes_por_closer * v_cfg.leads_por_reuniao,
    'sdrs_ativos', (select count(*) from pj where tipo = 'sdr' and conta),
    'sdrs_presentes', coalesce((select jsonb_agg(j order by nome) from pj where tipo = 'sdr' and conta and presente), '[]'),
    'sdrs_ausentes', coalesce((select jsonb_agg(j order by nome) from pj where tipo = 'sdr' and conta and not presente), '[]'),
    'agendamentos_possiveis', coalesce((select sum(meta) from pj where tipo = 'sdr' and conta and presente), 0),
    'agenda_do_dia', jsonb_build_object(
      'reunioes_r1', (select count(*) from slots),
      'leads_r1', (select count(*) from meeting_slot_attendees a where a.meeting_slot_id in (select id from slots)
                    and coalesce(a.is_partner, false) = false and a.status not in ('cancelled','canceled','rescheduled'))),
    'agendamentos_feitos_no_dia', (select count(*) from feitos),
    'agendamentos_feitos_reagendamentos', (select count(*) from feitos where parent_attendee_id is not null),
    'fora_da_conta', coalesce((select jsonb_agg(distinct nome) from pj where regra = 'fora_da_conta' or (regra is null and not conta)), '[]'),
    'confirmacao', (select jsonb_build_object('confirmado', true, 'por', pr.full_name, 'em', c.confirmado_em)
                     from presenca_confirmacoes c left join profiles pr on pr.id = c.confirmado_por
                     where c.data = p_data and c.bu = p_bu),
    'correcoes_lider', coalesce((select jsonb_agg(jsonb_build_object('tipo', k.tipo, 'nome', coalesce(pj.nome, pp.full_name),
                       'presente', k.presente, 'motivo', k.motivo, 'por', pc.full_name, 'em', k.corrigido_em) order by k.corrigido_em)
                     from presenca_correcoes k
                     left join pj on pj.profile_id = k.profile_id and pj.tipo = k.tipo
                     left join profiles pp on pp.id = k.profile_id
                     left join profiles pc on pc.id = k.corrigido_por
                     where k.data = p_data and k.bu = p_bu), '[]')
  ) into v;
  return v;
end $$;
revoke all on function public.capacidade_dia(date, text) from public, anon;
grant execute on function public.capacidade_dia(date, text) to authenticated, service_role;

-- Equipe agora (somente leitura; só a ponte com service role ou admin).
create or replace function public.equipe_agora(p_data date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_t0 timestamptz; v_t1 timestamptz; v jsonb;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.has_role(auth.uid(), 'admin'::app_role)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  v_t0 := v_data::timestamp at time zone 'America/Sao_Paulo';
  v_t1 := (v_data + 1)::timestamp at time zone 'America/Sao_Paulo';

  with p as (
    select 'incorporador'::text bu, x.* from public._presenca_pessoas(v_data, 'incorporador') x
    union all
    select 'consorcio', x.* from public._presenca_pessoas(v_data, 'consorcio') x
  ),
  slots as (
    select ms.id, ms.closer_id, ms.scheduled_at,
           ms.scheduled_at + make_interval(mins => coalesce(ms.duration_minutes, c.meeting_duration_minutes, 45)) fim
    from meeting_slots ms join closers c on c.id = ms.closer_id
    where ms.scheduled_at >= v_t0 and ms.scheduled_at < v_t1 and ms.status not in ('cancelled','canceled')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.pessoa_id, 'profile_id', p.profile_id, 'nome', p.nome, 'bu', p.bu, 'papel', p.papel,
    'fora_da_conta', not p.conta,
    'primeiro_acesso', (select to_char(min(l.created_at) at time zone 'America/Sao_Paulo', 'HH24:MI') from page_access_log l
                         where l.user_id = p.profile_id and l.created_at >= v_t0 and l.created_at < v_t1),
    'presenca', jsonb_build_object('presente', p.presente, 'origem', p.origem, 'motivo', p.corr_motivo),
    'em_reuniao_agora', case when p.tipo <> 'closer' then false when v_data <> v_hoje then null
                         else exists (select 1 from slots s where s.closer_id = p.pessoa_id and s.scheduled_at <= now() and now() < s.fim) end,
    'proxima_reuniao', case when p.tipo = 'closer' then
                         (select to_char(min(s.scheduled_at) at time zone 'America/Sao_Paulo', 'HH24:MI') from slots s
                          where s.closer_id = p.pessoa_id and s.scheduled_at > now()) end,
    'producao', case when p.tipo = 'sdr' then jsonb_build_object(
        'agendamentos_hoje', (select count(*) from meeting_slot_attendees a join meeting_slots ms on ms.id = a.meeting_slot_id
                               where a.booked_by = p.profile_id and ms.meeting_type = 'r1' and coalesce(a.is_partner, false) = false
                                 and coalesce(a.booked_at, a.created_at) >= v_t0 and coalesce(a.booked_at, a.created_at) < v_t1),
        'meta_diaria', p.meta)
      else (select jsonb_build_object(
        'reunioes_agendadas', count(*) filter (where a.status not in ('cancelled','canceled','rescheduled')),
        'reunioes_realizadas', count(*) filter (where a.status in ('completed','contract_paid','refunded')),
        'no_shows', count(*) filter (where a.status = 'no_show'),
        'contratos_pagos_hoje', (select count(*) from meeting_slot_attendees a2 join meeting_slots m2 on m2.id = a2.meeting_slot_id
                                  where m2.closer_id = p.pessoa_id and coalesce(a2.is_partner, false) = false
                                    and a2.contract_paid_at >= v_t0 and a2.contract_paid_at < v_t1))
        from slots s join meeting_slot_attendees a on a.meeting_slot_id = s.id
        where s.closer_id = p.pessoa_id and coalesce(a.is_partner, false) = false) end
  ) order by p.bu, p.tipo, p.nome), '[]'::jsonb)
  into v
  from p where coalesce(p.regra, '') <> 'saiu';

  return jsonb_build_object('data', v_data, 'agora', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI'), 'pessoas', v);
end $$;
revoke all on function public.equipe_agora(date) from public, anon, authenticated;
grant execute on function public.equipe_agora(date) to service_role;
