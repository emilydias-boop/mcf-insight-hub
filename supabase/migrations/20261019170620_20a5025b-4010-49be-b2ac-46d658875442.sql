CREATE TABLE public.processos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chave text UNIQUE NOT NULL, nome text NOT NULL, descricao text, created_at timestamptz DEFAULT now());
CREATE TABLE public.processo_etapas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE RESTRICT, chave text NOT NULL, titulo text NOT NULL, ordem int NOT NULL DEFAULT 0, UNIQUE(processo_id, chave));
CREATE TABLE public.processo_materiais (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 processo_id uuid NOT NULL REFERENCES public.processos(id),
 etapa_id uuid NOT NULL REFERENCES public.processo_etapas(id),
 titulo text NOT NULL,
 tipo text NOT NULL CHECK (tipo IN ('email','whatsapp','sms','pdf','video','canva','apresentacao','planilha','roteiro','fisico','sistema','outro')),
 status text NOT NULL DEFAULT 'falta_fazer' CHECK (status IN ('falta_fazer','rascunho','em_teste','a_confirmar','pronto')),
 responsavel_id uuid NULL REFERENCES public.profiles(id),
 assunto text, conteudo text, link_url text, arquivo_path text, arquivo_nome text, observacao text,
 ordem int NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true,
 created_at timestamptz DEFAULT now(), created_by uuid DEFAULT auth.uid(),
 updated_at timestamptz DEFAULT now(), updated_by uuid);
CREATE TABLE public.processo_materiais_historico (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), material_id uuid NOT NULL REFERENCES public.processo_materiais(id), alterado_em timestamptz DEFAULT now(), alterado_por uuid, campo text NOT NULL, valor_antigo text, valor_novo text);

GRANT SELECT, INSERT, UPDATE ON public.processos, public.processo_etapas, public.processo_materiais TO authenticated;
GRANT SELECT ON public.processo_materiais_historico TO authenticated;
GRANT ALL ON public.processos, public.processo_etapas, public.processo_materiais, public.processo_materiais_historico TO service_role;

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_materiais_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY processos_sel ON public.processos FOR SELECT TO authenticated USING (true);
CREATE POLICY processos_ins ON public.processos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso());
CREATE POLICY processos_upd ON public.processos FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso()) WITH CHECK (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso());
CREATE POLICY etapas_sel ON public.processo_etapas FOR SELECT TO authenticated USING (true);
CREATE POLICY etapas_ins ON public.processo_etapas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso());
CREATE POLICY etapas_upd ON public.processo_etapas FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso()) WITH CHECK (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso());
CREATE POLICY materiais_sel ON public.processo_materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY materiais_ins ON public.processo_materiais FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso());
CREATE POLICY materiais_upd ON public.processo_materiais FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso()) WITH CHECK (has_role(auth.uid(),'admin') OR pos_venda_tem_acesso());
CREATE POLICY materiais_hist_sel ON public.processo_materiais_historico FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.processo_materiais_tg_before_upd() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at := now(); NEW.updated_by := auth.uid(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.processo_materiais_tg_hist() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o jsonb; n jsonb; c text;
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO processo_materiais_historico(material_id, alterado_por, campo, valor_novo) VALUES (NEW.id, auth.uid(), 'criado', NEW.titulo);
  RETURN NEW;
 END IF;
 o := to_jsonb(OLD); n := to_jsonb(NEW);
 FOREACH c IN ARRAY ARRAY['titulo','tipo','status','responsavel_id','assunto','conteudo','link_url','arquivo_path','observacao','ativo','etapa_id'] LOOP
  IF (o->>c) IS DISTINCT FROM (n->>c) THEN
   INSERT INTO processo_materiais_historico(material_id, alterado_por, campo, valor_antigo, valor_novo) VALUES (NEW.id, auth.uid(), c, o->>c, n->>c);
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.processo_materiais_tg_hist() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER processo_materiais_before_upd BEFORE UPDATE ON public.processo_materiais FOR EACH ROW EXECUTE FUNCTION public.processo_materiais_tg_before_upd();
CREATE TRIGGER processo_materiais_after_upd AFTER UPDATE ON public.processo_materiais FOR EACH ROW EXECUTE FUNCTION public.processo_materiais_tg_hist();
CREATE TRIGGER processo_materiais_after_ins AFTER INSERT ON public.processo_materiais FOR EACH ROW EXECUTE FUNCTION public.processo_materiais_tg_hist();

CREATE POLICY processo_materiais_obj_sel ON storage.objects FOR SELECT TO authenticated USING (bucket_id='processo-materiais');
CREATE POLICY processo_materiais_obj_ins ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='processo-materiais' AND (public.has_role(auth.uid(),'admin') OR public.pos_venda_tem_acesso()));
CREATE POLICY processo_materiais_obj_upd ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='processo-materiais' AND (public.has_role(auth.uid(),'admin') OR public.pos_venda_tem_acesso())) WITH CHECK (bucket_id='processo-materiais' AND (public.has_role(auth.uid(),'admin') OR public.pos_venda_tem_acesso()));

INSERT INTO public.processos(chave,nome) VALUES ('pos-venda','Pós-venda · Gerentes de Relacionamento');
INSERT INTO public.processo_etapas(processo_id,chave,titulo,ordem)
SELECT p.id, v.chave, v.titulo, v.ordem FROM public.processos p, (VALUES
('geral','Geral',10),('r1v','R1 · Reunião de vendas',20),('compra','R2 · Apresentação e compra',30),('email','E-mail de boas-vindas',40),('contato','Primeiro contato no WhatsApp',50),('r1','Reunião de alinhamento',60),('alav','Aula de Alavancagem Patrimonial',70),('vender-0','Incorporar para vender · Etapa 1: Maturidade e mercado',80),('vender-1','Incorporar para vender · Etapa 2: Apresentação do produto imobiliário',90),('vender-2','Incorporar para vender · Etapa 3: Viabilidade e orçamento',100),('vender-3','Incorporar para vender · Etapa 4: Funding e execução',110),('alugar','Trilha Incorporar para alugar',120),('recursos','Trilha Levantamento de recursos',130),('cliente','Trilha Construir para cliente',140),('final','Check-in mensal',150)
) v(chave,titulo,ordem) WHERE p.chave='pos-venda';

INSERT INTO public.processo_materiais(processo_id,etapa_id,titulo,tipo,status,ordem,created_by)
SELECT p.id, e.id, v.titulo, v.tipo, v.status, v.ordem, NULL FROM public.processos p JOIN public.processo_etapas e ON e.processo_id=p.id JOIN (VALUES
('geral','Painel Comercial do Pós-Venda (Gestão, Visão Geral)','sistema','pronto',10),
('geral','Fluxograma do pós-venda','sistema','pronto',20),
('geral','Playbook dos gerentes da trilha Incorporar para vender','roteiro','pronto',30),
('r1v','Canva da R1 atual (venda da caução)','canva','pronto',10),
('r1v','Novo Canva da R1 para quando vendermos só o produto de R$ 5 mil','canva','falta_fazer',20),
('compra','Canva da R2: vantagens do produto','canva','falta_fazer',10),
('compra','Canva da R2: a jornada que o parceiro vai trilhar com a MCF','canva','falta_fazer',20),
('compra','Novo cliente entra sozinho no CRM Pós-Venda quando a venda é paga (Hubla, MCF Pay, Kiwify)','sistema','pronto',30),
('compra','Produto de R$ 5 mil (R$ 6 mil em 12x) vendido na R2: hoje só em teste, sem substituir o produto atual','outro','em_teste',40),
('email','Texto do e-mail','email','falta_fazer',10),
('email','Envio automático na hora da compra','sistema','falta_fazer',20),
('email','Gerente definido automaticamente quando o card é criado (distribuição por percentual)','sistema','pronto',30),
('contato','Distribuição automática do novo cliente para um gerente (Gestão)','sistema','pronto',10),
('contato','Roteiro da mensagem de boas-vindas no WhatsApp','whatsapp','falta_fazer',20),
('contato','PDF da pauta da Reunião 1','pdf','falta_fazer',30),
('contato','Aulas 01 a 09 gravadas','video','falta_fazer',40),
('contato','PDF de cada aula (01 a 09), para quem prefere ler','pdf','falta_fazer',50),
('r1','Cadastro no Harvey','sistema','pronto',10),
('r1','Formulário de anamnese','sistema','pronto',20),
('r1','Agenda de Reuniões do Pós-Venda no Gestão','sistema','pronto',30),
('r1','Parceiro marca sozinho o horário da Reunião 1 (hoje o Gestão não tem isso; quem marca é o GR)','sistema','falta_fazer',40),
('r1','Roteiro do GR para a Reunião 1 de alinhamento','roteiro','falta_fazer',50),
('r1','Modelo do PDF Mapa do Parceiro','pdf','falta_fazer',60),
('r1','Kit físico de cada trilha (pasta e fichas)','fisico','falta_fazer',70),
('alav','Agenda do Consórcio para marcar a reunião','sistema','pronto',10),
('alav','Apresentação da aula de alavancagem usada na reunião (existe)','apresentacao','pronto',20),
('alav','Melhorar a apresentação da aula de alavancagem','apresentacao','falta_fazer',30),
('vender-0','Roteiro do GR (playbook dos gerentes)','roteiro','pronto',10),
('vender-0','IA de condomínios','sistema','pronto',20),
('vender-0','Aula gravada da etapa','video','falta_fazer',30),
('vender-0','Modelo do PDF Diagnóstico de Maturidade','pdf','falta_fazer',40),
('vender-0','Ficha impressa','fisico','falta_fazer',50),
('vender-1','Roteiro e script de apresentação (playbook dos gerentes)','roteiro','pronto',10),
('vender-1','Aula gravada da etapa','video','falta_fazer',20),
('vender-1','Modelo do PDF Proposta de Produto','pdf','falta_fazer',30),
('vender-1','Ficha impressa','fisico','falta_fazer',40),
('vender-2','Roteiro do GR (playbook dos gerentes)','roteiro','pronto',10),
('vender-2','Planilha de Viabilidade (ninguém confirmou se existe)','planilha','a_confirmar',20),
('vender-2','Tabela padrão de custos MCF: projeto, aprovação, cartório, impostos (ninguém confirmou se existe)','planilha','a_confirmar',30),
('vender-2','Aula gravada da etapa','video','falta_fazer',40),
('vender-2','Ficha impressa','fisico','falta_fazer',50),
('vender-3','Roteiro do GR (playbook dos gerentes)','roteiro','pronto',10),
('vender-3','Aula gravada da etapa','video','falta_fazer',20),
('vender-3','Modelo do PDF Plano de Funding + 90 dias','pdf','falta_fazer',30),
('vender-3','Ficha impressa','fisico','falta_fazer',40),
('alugar','Sequência de reuniões da trilha','roteiro','falta_fazer',10),
('alugar','Roteiros do GR','roteiro','falta_fazer',20),
('alugar','Aulas gravadas','video','falta_fazer',30),
('alugar','Modelos de PDF das entregas','pdf','falta_fazer',40),
('alugar','Fichas impressas','fisico','falta_fazer',50),
('recursos','Sequência de reuniões da trilha','roteiro','falta_fazer',10),
('recursos','Roteiros do GR','roteiro','falta_fazer',20),
('recursos','Aulas gravadas','video','falta_fazer',30),
('recursos','Modelos de PDF das entregas','pdf','falta_fazer',40),
('recursos','Fichas impressas','fisico','falta_fazer',50),
('cliente','Sequência de reuniões da trilha','roteiro','falta_fazer',10),
('cliente','Roteiros do GR','roteiro','falta_fazer',20),
('cliente','Aulas gravadas','video','falta_fazer',30),
('cliente','Modelos de PDF das entregas','pdf','falta_fazer',40),
('cliente','Fichas impressas','fisico','falta_fazer',50),
('final','Rotina de check-in mensal no Gestão','sistema','falta_fazer',10),
('final','Dossiê do Projeto impresso','fisico','falta_fazer',20)
) v(chave,titulo,tipo,status,ordem) ON v.chave=e.chave WHERE p.chave='pos-venda';