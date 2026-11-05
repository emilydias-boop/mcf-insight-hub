CREATE SCHEMA IF NOT EXISTS gov_private;
GRANT USAGE ON SCHEMA gov_private TO authenticated;
ALTER FUNCTION public.gov_estrutura_em(date) SET SCHEMA gov_private;
ALTER FUNCTION public.gov_estrutura_mover(text,uuid,uuid) SET SCHEMA gov_private;
ALTER FUNCTION public.gov_setor_salvar(uuid,text,uuid,uuid) SET SCHEMA gov_private;
ALTER FUNCTION public.gov_cargo_salvar(uuid,text,uuid,uuid,int,text,numeric,numeric) SET SCHEMA gov_private;
ALTER FUNCTION public.gov_vinculo_atribuir(uuid,uuid,date,boolean,text) SET SCHEMA gov_private;
ALTER FUNCTION public.gov_vinculo_encerrar(uuid,date) SET SCHEMA gov_private;

CREATE FUNCTION public.gov_estrutura_em(p_data date DEFAULT current_date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_estrutura_em(p_data) $$;
CREATE FUNCTION public.gov_estrutura_mover(p_tipo text, p_id uuid, p_novo_pai uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_estrutura_mover(p_tipo,p_id,p_novo_pai) $$;
CREATE FUNCTION public.gov_setor_salvar(p_id uuid, p_nome text, p_parent_id uuid, p_responsavel uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_setor_salvar(p_id,p_nome,p_parent_id,p_responsavel) $$;
CREATE FUNCTION public.gov_cargo_salvar(p_id uuid, p_nome text, p_departamento_id uuid, p_reporta_a uuid, p_nivel int, p_descricao text, p_faixa_min numeric, p_faixa_max numeric) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_cargo_salvar(p_id,p_nome,p_departamento_id,p_reporta_a,p_nivel,p_descricao,p_faixa_min,p_faixa_max) $$;
CREATE FUNCTION public.gov_vinculo_atribuir(p_employee_id uuid, p_cargo_id uuid, p_data_inicio date, p_interino boolean DEFAULT false, p_observacao text DEFAULT NULL) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_vinculo_atribuir(p_employee_id,p_cargo_id,p_data_inicio,p_interino,p_observacao) $$;
CREATE FUNCTION public.gov_vinculo_encerrar(p_vinculo_id uuid, p_data_fim date) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_vinculo_encerrar(p_vinculo_id,p_data_fim) $$;

REVOKE EXECUTE ON FUNCTION public.gov_estrutura_em(date), public.gov_estrutura_mover(text,uuid,uuid), public.gov_setor_salvar(uuid,text,uuid,uuid),
  public.gov_cargo_salvar(uuid,text,uuid,uuid,int,text,numeric,numeric), public.gov_vinculo_atribuir(uuid,uuid,date,boolean,text), public.gov_vinculo_encerrar(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gov_estrutura_em(date), public.gov_estrutura_mover(text,uuid,uuid), public.gov_setor_salvar(uuid,text,uuid,uuid),
  public.gov_cargo_salvar(uuid,text,uuid,uuid,int,text,numeric,numeric), public.gov_vinculo_atribuir(uuid,uuid,date,boolean,text), public.gov_vinculo_encerrar(uuid,date) TO authenticated;