create extension if not exists pgcrypto;

create table public.feriados (
  data date primary key,
  nome text not null
);
grant select on public.feriados to authenticated;
grant all on public.feriados to service_role;
alter table public.feriados enable row level security;
create policy "Admins consultam feriados" on public.feriados for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.auditoria_destinatarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.auditoria_destinatarios to authenticated;
grant all on public.auditoria_destinatarios to service_role;
alter table public.auditoria_destinatarios enable row level security;
create policy "Admins gerenciam destinatarios da auditoria" on public.auditoria_destinatarios for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.auditoria_envios (
  id uuid primary key default gen_random_uuid(),
  data_ref date not null,
  enviado_em timestamptz not null default now(),
  destinatarios jsonb not null default '[]'::jsonb,
  status text not null,
  erro text,
  created_at timestamptz not null default now()
);
grant select on public.auditoria_envios to authenticated;
grant all on public.auditoria_envios to service_role;
alter table public.auditoria_envios enable row level security;
create policy "Admins consultam envios da auditoria" on public.auditoria_envios for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create unique index auditoria_envios_enviado_unico on public.auditoria_envios(data_ref) where status = 'enviado';
create index auditoria_envios_data_created on public.auditoria_envios(data_ref, created_at desc);

create table public.auditoria_cron_tickets (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
grant all on public.auditoria_cron_tickets to service_role;
alter table public.auditoria_cron_tickets enable row level security;
create index auditoria_cron_tickets_expira on public.auditoria_cron_tickets(expires_at) where consumed_at is null;

create or replace function public._auditoria_touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger auditoria_destinatarios_updated_at before update on public.auditoria_destinatarios for each row execute function public._auditoria_touch_updated_at();

insert into public.feriados(data, nome) values
('2026-01-01','Confraternização Universal'),('2026-04-21','Tiradentes'),('2026-05-01','Dia do Trabalho'),('2026-09-07','Independência do Brasil'),('2026-10-12','Nossa Senhora Aparecida'),('2026-11-02','Finados'),('2026-11-15','Proclamação da República'),('2026-11-20','Dia Nacional de Zumbi e da Consciência Negra'),('2026-12-25','Natal'),
('2027-01-01','Confraternização Universal'),('2027-04-21','Tiradentes'),('2027-05-01','Dia do Trabalho'),('2027-09-07','Independência do Brasil'),('2027-10-12','Nossa Senhora Aparecida'),('2027-11-02','Finados'),('2027-11-15','Proclamação da República'),('2027-11-20','Dia Nacional de Zumbi e da Consciência Negra'),('2027-12-25','Natal')
on conflict (data) do nothing;

insert into public.auditoria_destinatarios(email, nome) values
('Grimaldo.neto@minhacasafinanciada.com','Grimaldo Neto'),
('Jessica.bellini@minhacasafinanciada.com','Jessica Bellini'),
('Thobson.motta@minhacasafinanciada.com','Thobson Motta')
on conflict (email) do nothing;

create index if not exists idx_deal_activities_deal_created on public.deal_activities(deal_id, created_at);

create or replace function public._auditoria_dia_util(p_data date) returns boolean
language sql stable set search_path = public as $$
  select extract(isodow from p_data) between 1 and 5 and not exists(select 1 from public.feriados f where f.data = p_data);
$$;

create or replace function public._auditoria_proximo_dia_util(p_data date) returns date
language plpgsql stable set search_path = public as $$
declare v date := p_data + 1;
begin
  while not public._auditoria_dia_util(v) loop v := v + 1; end loop;
  return v;
end; $$;

create or replace function public._auditoria_dias_uteis_anteriores(p_ref date) returns setof date
language sql stable set search_path = public as $$
  select d::date from generate_series(p_ref - 60, p_ref - 1, interval '1 day') d
  where public._auditoria_dia_util(d::date) order by d desc limit 14;
$$;

create or replace function public.auditoria_noshow(p_ref date default (now() at time zone 'America/Sao_Paulo')::date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ref date := coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date);
  v_agora timestamptz := least(now(), ((coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date) + 1)::timestamp at time zone 'America/Sao_Paulo'));
  v_inicio date;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and (auth.uid() is null or not public.has_role(auth.uid(), 'admin')) then
    raise exception 'Acesso restrito a administradores';
  end if;
  select min(d) into v_inicio from public._auditoria_dias_uteis_anteriores(v_ref) d;
  return (
    with
    origens as (select entity_id from public.bu_origin_mapping where bu='incorporador' and entity_type='origin'),
    dias as (
      select d dia, public._auditoria_proximo_dia_util(d) limite, false parcial from public._auditoria_dias_uteis_anteriores(v_ref) d
      union all select v_ref, public._auditoria_proximo_dia_util(v_ref), true
    ),
    entradas0 as (
      select da.deal_id, da.created_at, (da.created_at at time zone 'America/Sao_Paulo')::date dia,
        row_number() over(partition by da.deal_id, (da.created_at at time zone 'America/Sao_Paulo')::date order by da.created_at, da.id) rn
      from public.deal_activities da join public.crm_deals d on d.id::text=da.deal_id join origens o on o.entity_id=d.origin_id
      where da.activity_type='stage_change' and da.metadata->>'to_stage_id' in ('8f170b9b-5c99-43ce-afeb-896e1a6f4151','22bba611-0036-4004-80b7-3a7b55b16696')
        and da.created_at >= (v_inicio::timestamp at time zone 'America/Sao_Paulo') and da.created_at < v_agora
    ),
    entradas as (select e.*, x.limite, x.parcial from entradas0 e join dias x using(dia) where e.rn=1),
    pessoas as (select lower(email) email, (array_agg(full_name order by created_at desc nulls last))[1] nome from public.profiles where email is not null group by lower(email)),
    acoes as (
      select da.deal_id, da.created_at, lower(p.email) actor_email, da.id::text action_id from public.deal_activities da left join public.profiles p on p.id=da.user_id
      where da.user_id is not null and da.activity_type in ('stage_change','note','qualification_note','click_to_call','contato_registrado') and da.created_at >= (v_inicio::timestamp at time zone 'America/Sao_Paulo') and da.created_at < v_agora
      union all select s.deal_id, s.created_at, lower(s.sdr_email), s.id::text from public.sonax_call_events s where s.sdr_email is not null and s.deal_id is not null and s.created_at >= (v_inicio::timestamp at time zone 'America/Sao_Paulo') and s.created_at < v_agora
      union all select t.deal_id::text, t.completed_at, lower(p.email), t.id::text from public.deal_tasks t left join public.profiles p on p.id=t.completed_by where t.completed_by is not null and t.completed_at is not null and t.completed_at >= (v_inicio::timestamp at time zone 'America/Sao_Paulo') and t.completed_at < v_agora
      union all select m.deal_id::text, coalesce(m.booked_at,m.created_at), lower(p.email), m.id::text from public.meeting_slot_attendees m left join public.profiles p on p.id=m.booked_by where m.booked_by is not null and m.deal_id is not null and coalesce(m.booked_at,m.created_at) >= (v_inicio::timestamp at time zone 'America/Sao_Paulo') and coalesce(m.booked_at,m.created_at) < v_agora
    ),
    reagendamentos as (
      select m.deal_id::text deal_id, coalesce(m.booked_at,m.created_at) created_at from public.meeting_slot_attendees m where m.deal_id is not null and coalesce(m.booked_at,m.created_at) >= (v_inicio::timestamp at time zone 'America/Sao_Paulo') and coalesce(m.booked_at,m.created_at) < v_agora
      union all select r.deal_id, r.created_at from public.deal_activities r where r.activity_type='stage_change' and r.metadata->>'to_stage_id' in ('a8365215-fd31-4bdc-bbe7-77100fa39e53','e9ed8f0e-a272-4eba-acc7-434191569282') and r.created_at >= (v_inicio::timestamp at time zone 'America/Sao_Paulo') and r.created_at < v_agora
    ),
    flags as (
      select e.*,
        exists(select 1 from acoes a where a.deal_id=e.deal_id and a.created_at>e.created_at+interval '2 minutes' and a.created_at<((e.limite+1)::timestamp at time zone 'America/Sao_Paulo')) acao_prazo,
        exists(select 1 from acoes a where a.deal_id=e.deal_id and a.created_at>e.created_at+interval '2 minutes') alguma_acao,
        exists(select 1 from reagendamentos r where r.deal_id=e.deal_id and r.created_at>e.created_at) reagendado,
        exists(select 1 from reagendamentos r where r.deal_id=e.deal_id and r.created_at>e.created_at and r.created_at<((e.limite+1)::timestamp at time zone 'America/Sao_Paulo')) reagendado_prazo
      from entradas e
    ),
    ranking as (
      select a.actor_email, count(distinct (e.deal_id,e.dia)) negocios, count(*) acoes
      from flags e join acoes a on a.deal_id=e.deal_id and a.created_at>e.created_at+interval '2 minutes' and a.created_at<((e.limite+1)::timestamp at time zone 'America/Sao_Paulo')
      where not e.parcial and a.actor_email is not null group by a.actor_email
    ),
    estoque as (
      select d.id, v_ref - (coalesce(d.stage_moved_at,d.updated_at,d.created_at) at time zone 'America/Sao_Paulo')::date idade
      from public.crm_deals d join origens o on o.entity_id=d.origin_id where d.stage_id in ('8f170b9b-5c99-43ce-afeb-896e1a6f4151','22bba611-0036-4004-80b7-3a7b55b16696')
    ),
    fila as (
      select d.owner_id, f.deal_id from flags f join public.crm_deals d on d.id::text=f.deal_id
      where f.dia=(select max(dia) from dias where not parcial) and not f.alguma_acao
    )
    select jsonb_build_object(
      'data_ref',v_ref,'gerado_em',v_agora,
      'dias',(select coalesce(jsonb_agg(jsonb_build_object('dia',dia,'entraram',entraram,'com_acao',com_acao,'percentual',case when entraram>0 then round(100.0*com_acao/entraram,0) else 0 end,'reagendados',reagendados,'reagendados_prazo',reagendados_prazo,'nunca_trabalhados',nunca,'parcial',parcial) order by dia),'[]'::jsonb) from (select dia,parcial,count(*) entraram,count(*) filter(where acao_prazo) com_acao,count(*) filter(where reagendado) reagendados,count(*) filter(where reagendado_prazo) reagendados_prazo,count(*) filter(where not alguma_acao and not reagendado) nunca from flags group by dia,parcial) x),
      'totais',(select jsonb_build_object('entraram',count(*),'com_acao',coalesce(sum(acao_prazo::int),0),'percentual',case when count(*)>0 then round(100.0*sum(acao_prazo::int)/count(*),0) else 0 end,'reagendados',coalesce(sum(reagendado::int),0),'reagendados_prazo',coalesce(sum(reagendado_prazo::int),0),'nunca_trabalhados',count(*) filter(where not alguma_acao and not reagendado)) from flags where not parcial),
      'ranking',(select coalesce(jsonb_agg(jsonb_build_object('nome',coalesce(p.nome,'Colaborador não identificado'),'negocios',r.negocios,'acoes',r.acoes) order by r.negocios desc,r.acoes desc,coalesce(p.nome,'')),'[]'::jsonb) from ranking r left join pessoas p on p.email=r.actor_email),
      'estoque',(select jsonb_agg(jsonb_build_object('faixa',faixa,'negocios',negocios) order by ordem) from (select case when idade<=1 then '0-1' when idade<=3 then '2-3' when idade<=7 then '4-7' else '>7' end faixa,count(*) negocios,case when idade<=1 then 1 when idade<=3 then 2 when idade<=7 then 3 else 4 end ordem from estoque group by 1,3) e),
      'fila',(select coalesce(jsonb_agg(jsonb_build_object('dono',coalesce(p.nome,'Sem dono'),'negocios',x.negocios) order by x.negocios desc,coalesce(p.nome,'Sem dono')),'[]'::jsonb) from (select owner_id,count(*) negocios from fila group by owner_id) x left join pessoas p on p.email=lower(x.owner_id)),
      'fila_total',(select count(*) from fila)
    )
  );
end; $$;

create or replace function public.auditoria_leads_sem_interacao(p_ref date default (now() at time zone 'America/Sao_Paulo')::date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ref date := coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date);
  v_agora timestamptz := least(now(), ((coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date) + 1)::timestamp at time zone 'America/Sao_Paulo'));
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and (auth.uid() is null or not public.has_role(auth.uid(), 'admin')) then raise exception 'Acesso restrito a administradores'; end if;
  return (
    with
    origens as (select entity_id from public.bu_origin_mapping where bu='incorporador' and entity_type='origin'),
    leads as (select d.id,d.owner_id,d.created_at from public.crm_deals d join origens o on o.entity_id=d.origin_id where d.created_at>=v_agora-interval '30 days' and d.created_at<v_agora),
    pessoas as (select lower(email) email,(array_agg(full_name order by created_at desc nulls last))[1] nome from public.profiles where email is not null group by lower(email)),
    acoes as (
      select da.deal_id,da.created_at,lower(p.email) actor_email,da.id::text action_id from public.deal_activities da left join public.profiles p on p.id=da.user_id where da.user_id is not null and da.activity_type in ('stage_change','note','qualification_note','click_to_call','contato_registrado') and da.created_at>=v_agora-interval '30 days' and da.created_at<v_agora
      union all select s.deal_id,s.created_at,lower(s.sdr_email),s.id::text from public.sonax_call_events s where s.sdr_email is not null and s.deal_id is not null and s.created_at>=v_agora-interval '30 days' and s.created_at<v_agora
      union all select t.deal_id::text,t.completed_at,lower(p.email),t.id::text from public.deal_tasks t left join public.profiles p on p.id=t.completed_by where t.completed_by is not null and t.completed_at is not null and t.completed_at>=v_agora-interval '30 days' and t.completed_at<v_agora
      union all select m.deal_id::text,coalesce(m.booked_at,m.created_at),lower(p.email),m.id::text from public.meeting_slot_attendees m left join public.profiles p on p.id=m.booked_by where m.booked_by is not null and m.deal_id is not null and coalesce(m.booked_at,m.created_at)>=v_agora-interval '30 days' and coalesce(m.booked_at,m.created_at)<v_agora
    ),
    eventos as (select l.*,a.actor_email,a.created_at acao_em,a.action_id,row_number() over(partition by l.id order by a.created_at,a.action_id) rn from leads l join acoes a on a.deal_id=l.id::text and a.created_at>l.created_at),
    flags as (select l.*,not exists(select 1 from acoes a where a.deal_id=l.id::text and a.created_at>l.created_at) sem_interacao from leads l),
    por_dono as (select owner_id,count(*) filter(where created_at>=v_agora-interval '7 days') criados_7d,count(*) filter(where created_at>=v_agora-interval '7 days' and sem_interacao) sem_7d,count(*) criados_30d,count(*) filter(where sem_interacao) sem_30d,round(avg(case when sem_interacao then v_ref-(created_at at time zone 'America/Sao_Paulo')::date end)::numeric,1) idade_media from flags group by owner_id),
    colaboradores as (
      select actor_email,count(*) filter(where rn=1 and created_at>=v_agora-interval '7 days') primeiro_7d,count(*) filter(where rn=1) primeiro_30d,count(*) filter(where created_at>=v_agora-interval '7 days') interacoes_7d,count(*) interacoes_30d from eventos where actor_email is not null group by actor_email
    )
    select jsonb_build_object(
      'data_ref',v_ref,'gerado_em',v_agora,
      'totais',(select jsonb_build_object('criados_7d',count(*) filter(where created_at>=v_agora-interval '7 days'),'sem_interacao_7d',count(*) filter(where created_at>=v_agora-interval '7 days' and sem_interacao),'percentual_7d',case when count(*) filter(where created_at>=v_agora-interval '7 days')>0 then round(100.0*count(*) filter(where created_at>=v_agora-interval '7 days' and sem_interacao)/count(*) filter(where created_at>=v_agora-interval '7 days'),0) else 0 end,'criados_30d',count(*),'sem_interacao_30d',count(*) filter(where sem_interacao)) from flags),
      'por_dono',(select coalesce(jsonb_agg(jsonb_build_object('dono',coalesce(p.nome,'Sem dono'),'criados_7d',x.criados_7d,'sem_interacao_7d',x.sem_7d,'criados_30d',x.criados_30d,'sem_interacao_30d',x.sem_30d,'idade_media_dias',x.idade_media) order by x.sem_7d desc,x.sem_30d desc,coalesce(p.nome,'Sem dono')),'[]'::jsonb) from por_dono x left join pessoas p on p.email=lower(x.owner_id)),
      'colaboradores',(select coalesce(jsonb_agg(jsonb_build_object('nome',coalesce(p.nome,'Colaborador não identificado'),'primeiro_7d',c.primeiro_7d,'primeiro_30d',c.primeiro_30d,'interacoes_7d',c.interacoes_7d,'interacoes_30d',c.interacoes_30d) order by c.primeiro_30d desc,c.interacoes_30d desc,coalesce(p.nome,'')),'[]'::jsonb) from colaboradores c left join pessoas p on p.email=c.actor_email),
      'fila',(select coalesce(jsonb_agg(jsonb_build_object('dono',coalesce(p.nome,'Sem dono'),'idade_0_1',x.idade_0_1,'idade_2_3',x.idade_2_3,'idade_4_7',x.idade_4_7,'total',x.total) order by x.total desc,coalesce(p.nome,'Sem dono')),'[]'::jsonb) from (select owner_id,count(*) filter(where v_ref-(created_at at time zone 'America/Sao_Paulo')::date<=1) idade_0_1,count(*) filter(where v_ref-(created_at at time zone 'America/Sao_Paulo')::date between 2 and 3) idade_2_3,count(*) filter(where v_ref-(created_at at time zone 'America/Sao_Paulo')::date between 4 and 7) idade_4_7,count(*) total from flags where created_at>=v_agora-interval '7 days' and sem_interacao group by owner_id) x left join pessoas p on p.email=lower(x.owner_id)),
      'fila_total',(select count(*) from flags where created_at>=v_agora-interval '7 days' and sem_interacao)
    )
  );
end; $$;

create or replace function public.auditoria_contato_d0(p_ref date default (now() at time zone 'America/Sao_Paulo')::date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ref date := coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date);
  v_agora timestamptz := least(now(), ((coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date) + 1)::timestamp at time zone 'America/Sao_Paulo'));
  v_inicio timestamptz := ((coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date)-14)::timestamp at time zone 'America/Sao_Paulo');
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and (auth.uid() is null or not public.has_role(auth.uid(), 'admin')) then raise exception 'Acesso restrito a administradores'; end if;
  return (
    with
    origens as (select entity_id from public.bu_origin_mapping where bu='incorporador' and entity_type='origin'),
    pessoas as (select lower(email) email,(array_agg(full_name order by created_at desc nulls last))[1] nome from public.profiles where email is not null group by lower(email)),
    contatos as (
      select da.deal_id,da.created_at from public.deal_activities da where da.user_id is not null and da.activity_type in ('click_to_call','contato_registrado') and da.created_at>=v_inicio and da.created_at<v_agora
      union all select s.deal_id,s.created_at from public.sonax_call_events s where s.sdr_email is not null and s.deal_id is not null and s.created_at>=v_inicio and s.created_at<v_agora
    ),
    base as (
      select d.id,d.owner_id,d.created_at,(d.created_at at time zone 'America/Sao_Paulo') local,
        case when not public._auditoria_dia_util((d.created_at at time zone 'America/Sao_Paulo')::date) then 'fds' when extract(hour from d.created_at at time zone 'America/Sao_Paulo')<8 then 'antes8' when extract(hour from d.created_at at time zone 'America/Sao_Paulo')>=18 then 'apos18' else 'expediente' end janela,
        (select min(c.created_at) from contatos c where c.deal_id=d.id::text and c.created_at>d.created_at) primeiro
      from public.crm_deals d join origens o on o.entity_id=d.origin_id where d.created_at>=v_inicio and d.created_at<v_agora
    ),
    flags as (
      select b.*,public._auditoria_proximo_dia_util(local::date) prox,
        primeiro<((local::date+1)::timestamp at time zone 'America/Sao_Paulo') mesmo_dia,
        (janela='apos18' and primeiro<((public._auditoria_proximo_dia_util(local::date)::timestamp+time '12:00') at time zone 'America/Sao_Paulo')) ate12,
        (janela='fds' and primeiro<((public._auditoria_proximo_dia_util(local::date)+1)::timestamp at time zone 'America/Sao_Paulo')) ate_fim
      from base b
    ),
    janelas as (
      select janela,count(*) criados,count(*) filter(where mesmo_dia) mesmo_dia,count(*) filter(where ate12) ate12,count(*) filter(where ate_fim) ate_fim,count(*) filter(where primeiro is null) nunca,round(percentile_cont(0.5) within group(order by extract(epoch from(primeiro-created_at))/3600.0)::numeric,1) mediana from flags group by janela
    )
    select jsonb_build_object(
      'data_ref',v_ref,'gerado_em',v_agora,
      'totais',(select jsonb_build_object('criados',count(*),'contato_mesmo_dia',count(*) filter(where mesmo_dia),'percentual_mesmo_dia',case when count(*)>0 then round(100.0*count(*) filter(where mesmo_dia)/count(*),0) else 0 end,'nunca_contatados',count(*) filter(where primeiro is null),'mediana_horas',round(percentile_cont(0.5) within group(order by extract(epoch from(primeiro-created_at))/3600.0)::numeric,1)) from flags),
      'janelas',(select coalesce(jsonb_agg(jsonb_build_object('janela',janela,'criados',criados,'contato_mesmo_dia',mesmo_dia,'percentual_mesmo_dia',case when criados>0 then round(100.0*mesmo_dia/criados,0) else 0 end,'ate_12h_proximo',ate12,'percentual_ate_12h',case when janela='apos18' and criados>0 then round(100.0*ate12/criados,0) else null end,'ate_fim_proximo',ate_fim,'percentual_ate_fim',case when janela='fds' and criados>0 then round(100.0*ate_fim/criados,0) else null end,'nunca_contatados',nunca,'mediana_horas',mediana) order by case janela when 'expediente' then 1 when 'antes8' then 2 when 'apos18' then 3 else 4 end),'[]'::jsonb) from janelas),
      'por_dia',(select coalesce(jsonb_agg(jsonb_build_object('dia',dia,'criados',criados,'contato_mesmo_dia',mesmo_dia,'percentual',case when criados>0 then round(100.0*mesmo_dia/criados,0) else 0 end) order by dia),'[]'::jsonb) from (select local::date dia,count(*) criados,count(*) filter(where mesmo_dia) mesmo_dia from flags group by local::date) x),
      'por_dono',(select coalesce(jsonb_agg(jsonb_build_object('dono',coalesce(p.nome,'Sem dono'),'expediente_criados',x.exp_criados,'expediente_mesmo_dia',x.exp_mesmo,'expediente_pct',case when x.exp_criados>0 then round(100.0*x.exp_mesmo/x.exp_criados,0) else null end,'apos18_criados',x.noite_criados,'apos18_ate_12h',x.noite_12,'apos18_pct',case when x.noite_criados>0 then round(100.0*x.noite_12/x.noite_criados,0) else null end,'fds_criados',x.fds_criados,'fds_ate_fim',x.fds_fim,'fds_pct',case when x.fds_criados>0 then round(100.0*x.fds_fim/x.fds_criados,0) else null end,'nunca_contatados',x.nunca,'mediana_horas',x.mediana) order by x.exp_mesmo desc,coalesce(p.nome,'Sem dono')),'[]'::jsonb) from (select owner_id,count(*) filter(where janela='expediente') exp_criados,count(*) filter(where janela='expediente' and mesmo_dia) exp_mesmo,count(*) filter(where janela='apos18') noite_criados,count(*) filter(where ate12) noite_12,count(*) filter(where janela='fds') fds_criados,count(*) filter(where ate_fim) fds_fim,count(*) filter(where primeiro is null) nunca,round(percentile_cont(0.5) within group(order by extract(epoch from(primeiro-created_at))/3600.0)::numeric,1) mediana from flags group by owner_id) x left join pessoas p on p.email=lower(x.owner_id))
    )
  );
end; $$;

create or replace function public.auditoria_cron_disparar(p_body jsonb default '{}'::jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  insert into public.auditoria_cron_tickets(token_hash,expires_at) values(encode(digest(v_token,'sha256'),'hex'),now()+interval '5 minutes');
  perform net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/auditoria-diaria-email',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE','x-auditoria-cron-token',v_token),
    body := coalesce(p_body,'{}'::jsonb)
  );
end; $$;

revoke all on function public._auditoria_dia_util(date) from public, anon, authenticated;
revoke all on function public._auditoria_proximo_dia_util(date) from public, anon, authenticated;
revoke all on function public._auditoria_dias_uteis_anteriores(date) from public, anon, authenticated;
revoke all on function public.auditoria_noshow(date) from public, anon;
revoke all on function public.auditoria_leads_sem_interacao(date) from public, anon;
revoke all on function public.auditoria_contato_d0(date) from public, anon;
grant execute on function public.auditoria_noshow(date) to authenticated, service_role;
grant execute on function public.auditoria_leads_sem_interacao(date) to authenticated, service_role;
grant execute on function public.auditoria_contato_d0(date) to authenticated, service_role;
revoke all on function public.auditoria_cron_disparar(jsonb) from public, anon, authenticated;
grant execute on function public.auditoria_cron_disparar(jsonb) to service_role;
