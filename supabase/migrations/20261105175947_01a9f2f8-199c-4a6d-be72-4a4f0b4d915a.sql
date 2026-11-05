ALTER TABLE public.jornada_etapas ADD COLUMN codigo_trilha text UNIQUE;
UPDATE public.jornada_etapas SET ordem=-ordem WHERE slug IN ('compra','onboarding','cadastro_harvey');
UPDATE public.jornada_etapas SET ordem=100,ativa=false WHERE slug='compra';
UPDATE public.jornada_etapas SET ordem=1,codigo_trilha='f3',titulo='Onboarding & Boas-vindas' WHERE slug='onboarding';
UPDATE public.jornada_etapas SET ordem=2,codigo_trilha='f4',titulo='Acesso ao HARVEY' WHERE slug='cadastro_harvey';
INSERT INTO public.jornada_etapas(ordem,slug,codigo_trilha,titulo) VALUES (3,'gerentes_conta','f5','Gerentes de Conta'),(4,'projeto_imobiliario','f6','Projeto Imobiliário'),(5,'credito_recursos','f7','Crédito & Levantamento de Recursos'),(6,'mcf_alavancagem','f8','MCF ALAVANCAGEM');
CREATE TABLE public.jornada_mapa_estagios(stage_id uuid PRIMARY KEY REFERENCES public.crm_stages(id) ON DELETE CASCADE, etapa_id uuid NOT NULL REFERENCES public.jornada_etapas(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.jornada_mapa_estagios TO authenticated;
GRANT ALL ON public.jornada_mapa_estagios TO service_role;
ALTER TABLE public.jornada_mapa_estagios ENABLE ROW LEVEL SECURITY;
CREATE POLICY jornada_mapa_leitura ON public.jornada_mapa_estagios FOR SELECT TO authenticated USING (true);
CREATE POLICY jornada_mapa_admin ON public.jornada_mapa_estagios FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.jornada_validar_mapa() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.crm_stages WHERE id=NEW.stage_id AND origin_id='b05a0000-0000-4000-8000-000000000002') OR NOT EXISTS(SELECT 1 FROM public.jornada_etapas WHERE id=NEW.etapa_id AND codigo_trilha IN ('f3','f4','f5','f6','f7','f8') AND ativa) THEN RAISE EXCEPTION 'Selecione estágio da Pós-Venda e fase ativa da trilha'; END IF;
 NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER jornada_validar_mapa BEFORE INSERT OR UPDATE ON public.jornada_mapa_estagios FOR EACH ROW EXECUTE FUNCTION public.jornada_validar_mapa();
DROP TRIGGER IF EXISTS trg_jornada_deal_ins ON public.crm_deals;
DROP TRIGGER IF EXISTS trg_jornada_deal_upd ON public.crm_deals;
DROP TRIGGER IF EXISTS trg_jornada_evento ON public.crm_deals;
DROP TRIGGER IF EXISTS trg_jornada_nota ON public.deal_activities;
CREATE OR REPLACE FUNCTION public.jornada_definir_etapa(p_deal_id uuid,p_etapa_id uuid,p_observacao text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'A jornada agora é calculada pelos estágios e registros do HARVEY'; END $$;
CREATE FUNCTION public.jornada_cpf_candidatos() RETURNS TABLE(deal_id uuid, cpf text, comprador_nome text, contato_nome text, contato_id uuid, metodo text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH compras AS MATERIALIZED (SELECT regexp_replace(customer_document,'[^0-9]','','g') cpf, nullif(lower(trim(customer_email)),'') email, right(regexp_replace(customer_phone,'[^0-9]','','g'),11) telefone, customer_name nome FROM public.hubla_transactions WHERE length(regexp_replace(customer_document,'[^0-9]','','g'))=11), contatos AS MATERIALIZED (SELECT id,name,nullif(lower(trim(email)),'') email,right(regexp_replace(phone,'[^0-9]','','g'),11) telefone FROM public.crm_contacts), vinculos AS (SELECT c.id,c.name,t.cpf,t.nome,'email'::text metodo FROM compras t JOIN contatos c ON c.email=t.email WHERE t.email IS NOT NULL UNION ALL SELECT c.id,c.name,t.cpf,t.nome,'telefone'::text FROM compras t JOIN contatos c ON c.telefone=t.telefone WHERE length(t.telefone)=11 AND NOT EXISTS(SELECT 1 FROM contatos ce WHERE t.email IS NOT NULL AND ce.email=t.email)) SELECT DISTINCT d.id,v.cpf,v.nome,v.name,v.id,v.metodo FROM vinculos v JOIN public.crm_deals d ON d.contact_id=v.id WHERE d.origin_id='b05a0000-0000-4000-8000-000000000002' AND NOT d.is_archived;
$$;
REVOKE ALL ON FUNCTION public.jornada_cpf_candidatos() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jornada_cpf_candidatos() TO service_role;
CREATE FUNCTION public.jornada_resolver_cpf(p_cpf text) RETURNS TABLE(deal_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH candidatos AS MATERIALIZED (SELECT * FROM public.jornada_cpf_candidatos()), seguros AS (SELECT c.deal_id FROM candidatos c JOIN public.crm_deals d ON d.id=c.deal_id GROUP BY c.deal_id,d.cpf HAVING count(DISTINCT c.cpf)=1 AND min(c.cpf)=p_cpf AND (nullif(trim(d.cpf),'') IS NULL OR regexp_replace(d.cpf,'[^0-9]','','g')=p_cpf)) SELECT s.deal_id FROM seguros s JOIN public.crm_deals d ON d.id=s.deal_id ORDER BY d.created_at DESC,d.id DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.jornada_resolver_cpf(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jornada_resolver_cpf(text) TO service_role;