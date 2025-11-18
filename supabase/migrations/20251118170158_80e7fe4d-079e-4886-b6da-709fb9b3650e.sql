-- =====================================================
-- MCF DASHBOARD - SCHEMA COMPLETO + RBAC (CORRIGIDO)
-- =====================================================

-- 1. PROFILES (Perfis de Usuários)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Trigger para criar perfil automaticamente ao signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS: Usuário pode ver e editar apenas seu próprio perfil
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- 2. USER ROLES (RBAC - CRÍTICO!)
create type public.app_role as enum ('admin', 'manager', 'viewer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Função SECURITY DEFINER para evitar recursão RLS
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Função para pegar o role do usuário atual
create or replace function public.get_user_role(_user_id uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles
  where user_id = _user_id
  limit 1
$$;

-- Trigger para tornar primeiro usuário admin automaticamente
create or replace function public.auto_assign_first_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count int;
begin
  select count(*) into user_count from public.user_roles;
  
  if user_count = 0 then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role)
    values (new.id, 'viewer');
  end if;
  
  return new;
end;
$$;

create trigger on_user_created_assign_role
  after insert on auth.users
  for each row execute procedure public.auto_assign_first_admin();

-- RLS: Todos podem ver seus próprios roles
create policy "Users can view own role"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

-- RLS: Apenas admins podem inserir/atualizar roles
create policy "Admins can manage roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 3. CHANNELS (Canais de Venda)
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  created_at timestamptz default now()
);

alter table public.channels enable row level security;

insert into public.channels (name, color) values
  ('A010', '#10b981'),
  ('Instagram', '#e91e63'),
  ('Contratos', '#3b82f6'),
  ('OB Evento', '#f59e0b'),
  ('OB Construir', '#8b5cf6'),
  ('OB Vitalício', '#ec4899');

create policy "Authenticated users can view channels"
  on public.channels for select
  to authenticated
  using (true);

create policy "Admins can manage channels"
  on public.channels for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 4. CATEGORIES (Categorias de Custo)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text check (type in ('fixo', 'variavel')),
  color text,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

insert into public.categories (name, type, color) values
  ('Marketing', 'variavel', '#f59e0b'),
  ('Pessoal', 'fixo', '#3b82f6'),
  ('Operacional', 'variavel', '#10b981'),
  ('Administrativo', 'fixo', '#8b5cf6');

create policy "Authenticated users can view categories"
  on public.categories for select
  to authenticated
  using (true);

create policy "Admins can manage categories"
  on public.categories for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 5. TRANSACTIONS (Receitas e Custos)
create type public.transaction_type as enum ('receita', 'custo');
create type public.transaction_status as enum ('pago', 'pendente', 'cancelado');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  amount decimal(12,2) not null,
  type transaction_type not null,
  status transaction_status default 'pendente',
  channel_id uuid references public.channels(id),
  category_id uuid references public.categories(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.transactions enable row level security;

create index idx_transactions_date on public.transactions(date);
create index idx_transactions_type on public.transactions(type);
create index idx_transactions_channel on public.transactions(channel_id);
create index idx_transactions_category on public.transactions(category_id);

create policy "Viewers can view transactions"
  on public.transactions for select
  to authenticated
  using (true);

create policy "Managers can insert transactions"
  on public.transactions for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

create policy "Managers can update transactions"
  on public.transactions for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

create policy "Admins can delete transactions"
  on public.transactions for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- 6. FUNNELS (Funis de Conversão)
create table public.funnels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  channel_id uuid references public.channels(id),
  created_at timestamptz default now()
);

alter table public.funnels enable row level security;

insert into public.funnels (name) values
  ('Funil A010'),
  ('Funil Instagram');

create policy "Authenticated users can view funnels"
  on public.funnels for select
  to authenticated
  using (true);

create policy "Admins can manage funnels"
  on public.funnels for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 7. FUNNEL STAGES (Etapas dos Funis)
create table public.funnel_stages (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid references public.funnels(id) on delete cascade not null,
  stage_number int not null,
  name text not null,
  target_conversion_rate decimal(5,2),
  created_at timestamptz default now(),
  unique (funnel_id, stage_number)
);

alter table public.funnel_stages enable row level security;

create policy "Authenticated users can view stages"
  on public.funnel_stages for select
  to authenticated
  using (true);

create policy "Managers can manage stages"
  on public.funnel_stages for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  )
  with check (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

-- 8. FUNNEL DATA (Dados por Etapa)
create table public.funnel_data (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid references public.funnel_stages(id) on delete cascade not null,
  date date not null,
  leads_count int not null default 0,
  conversion_rate decimal(5,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (stage_id, date)
);

alter table public.funnel_data enable row level security;

create index idx_funnel_data_date on public.funnel_data(date);
create index idx_funnel_data_stage on public.funnel_data(stage_id);

create policy "Viewers can view funnel data"
  on public.funnel_data for select
  to authenticated
  using (true);

create policy "Managers can manage funnel data"
  on public.funnel_data for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  )
  with check (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

-- 9. PROJECTS (Projetos de Incorporação)
create type public.project_status as enum ('a_fazer', 'em_andamento', 'concluido', 'cancelado');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status project_status default 'a_fazer',
  progress int default 0 check (progress >= 0 and progress <= 100),
  start_date date,
  end_date date,
  responsible_id uuid references auth.users(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;

create index idx_projects_status on public.projects(status);

create policy "Authenticated users can view projects"
  on public.projects for select
  to authenticated
  using (true);

create policy "Managers can manage projects"
  on public.projects for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  )
  with check (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

-- 10. PROJECT COMMENTS (Comentários em Projetos)
create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  comment text not null,
  created_at timestamptz default now()
);

alter table public.project_comments enable row level security;

create index idx_comments_project on public.project_comments(project_id);

create policy "Authenticated users can view comments"
  on public.project_comments for select
  to authenticated
  using (true);

create policy "Authenticated users can create comments"
  on public.project_comments for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete own comments"
  on public.project_comments for delete
  to authenticated
  using (
    user_id = auth.uid() or 
    public.has_role(auth.uid(), 'admin')
  );

-- 11. CREDIT CLIENTS (Clientes de Crédito)
create table public.credit_clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  cpf text unique not null,
  email text,
  phone text,
  credit_score int check (credit_score >= 0 and credit_score <= 1000),
  total_credit decimal(12,2) default 0,
  total_debt decimal(12,2) default 0,
  status text check (status in ('ativo', 'inadimplente', 'inativo')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.credit_clients enable row level security;

create index idx_clients_cpf on public.credit_clients(cpf);
create index idx_clients_status on public.credit_clients(status);

create policy "Managers can view clients"
  on public.credit_clients for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

create policy "Managers can manage clients"
  on public.credit_clients for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  )
  with check (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

-- 12. CREDIT HISTORY (Histórico de Crédito)
create table public.credit_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.credit_clients(id) on delete cascade not null,
  amount decimal(12,2) not null,
  type text check (type in ('credito', 'pagamento', 'ajuste')),
  description text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

alter table public.credit_history enable row level security;

create index idx_credit_history_client on public.credit_history(client_id);
create index idx_credit_history_date on public.credit_history(created_at);

create policy "Managers can view credit history"
  on public.credit_history for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

create policy "Managers can manage credit history"
  on public.credit_history for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  )
  with check (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

-- 13. AUCTIONS (Leilões)
create type public.auction_status as enum ('ativo', 'encerrado', 'cancelado');

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  property_name text not null,
  address text not null,
  initial_value decimal(12,2) not null,
  current_bid decimal(12,2),
  status auction_status default 'ativo',
  start_date timestamptz not null,
  end_date timestamptz not null,
  image_url text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.auctions enable row level security;

create index idx_auctions_status on public.auctions(status);
create index idx_auctions_end_date on public.auctions(end_date);

create policy "Authenticated users can view auctions"
  on public.auctions for select
  to authenticated
  using (true);

create policy "Managers can manage auctions"
  on public.auctions for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  )
  with check (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

-- 14. AUCTION BIDS (Lances em Leilões)
create table public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid references public.auctions(id) on delete cascade not null,
  bidder_name text not null,
  bid_amount decimal(12,2) not null,
  created_at timestamptz default now()
);

alter table public.auction_bids enable row level security;

create index idx_bids_auction on public.auction_bids(auction_id);
create index idx_bids_date on public.auction_bids(created_at);

create policy "Authenticated users can view bids"
  on public.auction_bids for select
  to authenticated
  using (true);

create policy "Managers can create bids"
  on public.auction_bids for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

-- 15. ALERTS (Alertas e Notificações)
create type public.alert_level as enum ('info', 'warning', 'critical');

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  level alert_level not null,
  is_resolved boolean default false,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

alter table public.alerts enable row level security;

create index idx_alerts_level on public.alerts(level);
create index idx_alerts_resolved on public.alerts(is_resolved);

create policy "Authenticated users can view alerts"
  on public.alerts for select
  to authenticated
  using (true);

create policy "Managers can resolve alerts"
  on public.alerts for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

create policy "Admins can create alerts"
  on public.alerts for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- 16. ALERT RULES (Regras de Alertas Automáticos)
create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  condition text not null,
  alert_level alert_level not null,
  is_active boolean default true,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.alert_rules enable row level security;

create policy "Authenticated users can view alert rules"
  on public.alert_rules for select
  to authenticated
  using (true);

create policy "Admins can manage alert rules"
  on public.alert_rules for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 17. REPORTS (Relatórios Salvos)
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  start_date date,
  end_date date,
  data jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

alter table public.reports enable row level security;

create index idx_reports_type on public.reports(type);
create index idx_reports_date on public.reports(created_at);

create policy "Users can view own reports"
  on public.reports for select
  to authenticated
  using (created_by = auth.uid());

create policy "Managers can view all reports"
  on public.reports for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

create policy "Authenticated users can create reports"
  on public.reports for insert
  to authenticated
  with check (created_by = auth.uid());

-- 18. SETTINGS (Configurações Globais)
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;

create policy "Authenticated users can view settings"
  on public.settings for select
  to authenticated
  using (true);

create policy "Admins can manage settings"
  on public.settings for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 19. INTEGRATIONS (Integrações Externas)
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  type text not null,
  config jsonb,
  is_active boolean default false,
  last_sync timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.integrations enable row level security;

create policy "Managers can view integrations"
  on public.integrations for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'manager') or 
    public.has_role(auth.uid(), 'admin')
  );

create policy "Admins can manage integrations"
  on public.integrations for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 20. AUDIT LOGS (Logs de Auditoria)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;

create index idx_audit_user on public.audit_logs(user_id);
create index idx_audit_table on public.audit_logs(table_name);
create index idx_audit_date on public.audit_logs(created_at);

create policy "Admins can view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- SEED DATA (CORRIGIDO COM CAST)
insert into public.transactions (date, description, amount, type, status, channel_id)
select
  (current_date - (random() * 90)::int),
  'Venda ' || (random() * 1000)::int,
  (random() * 10000 + 1000)::decimal(12,2),
  'receita'::transaction_type,
  (case when random() > 0.2 then 'pago' else 'pendente' end)::transaction_status,
  (select id from public.channels order by random() limit 1)
from generate_series(1, 100);

insert into public.transactions (date, description, amount, type, status, category_id)
select
  (current_date - (random() * 90)::int),
  'Despesa ' || (random() * 1000)::int,
  (random() * 5000 + 500)::decimal(12,2),
  'custo'::transaction_type,
  'pago'::transaction_status,
  (select id from public.categories order by random() limit 1)
from generate_series(1, 80);

insert into public.projects (name, description, status, progress)
values
  ('Edifício Solar', 'Empreendimento residencial com 120 unidades', 'concluido'::project_status, 100),
  ('Residencial Green Park', 'Condomínio fechado com área de lazer', 'em_andamento'::project_status, 60),
  ('Condomínio Vista Mar', 'Apartamentos com vista para o mar', 'em_andamento'::project_status, 40),
  ('Torre Empresarial MCF', 'Salas comerciais no centro', 'a_fazer'::project_status, 0);

insert into public.alerts (title, description, level)
values
  ('Meta de A010 não atingida', 'Etapa 03 em 55% (meta: 60%)', 'critical'::alert_level),
  ('Custo de marketing elevado', 'Aumento de 40% vs mês anterior', 'warning'::alert_level),
  ('CIR acima de 5%', 'Taxa de inadimplência em 5.8%', 'critical'::alert_level),
  ('Novo projeto iniciado', 'Edifício Solar entrou em fase de construção', 'info'::alert_level);

insert into public.auctions (property_name, address, initial_value, current_bid, status, start_date, end_date)
values
  ('Casa 3 quartos', 'Rua das Flores, 123', 250000, 280000, 'ativo'::auction_status, now() - interval '5 days', now() + interval '10 days'),
  ('Apartamento Centro', 'Av. Principal, 456', 180000, 195000, 'ativo'::auction_status, now() - interval '3 days', now() + interval '7 days');