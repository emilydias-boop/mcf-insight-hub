-- BU Pós Venda: grupo, pipeline e etapas (registros novos)
INSERT INTO public.crm_groups (id, clint_id, name, display_name, description)
VALUES ('b05a0000-0000-4000-8000-000000000001','bu-pos-venda','BU - PÓS VENDA','BU - PÓS VENDA','BU Pós Venda — criada em 08/10/2026')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crm_origins (id, clint_id, name, display_name, description, group_id, pipeline_type)
VALUES ('b05a0000-0000-4000-8000-000000000002','pipeline-relacionamento-pos-venda','Relacionamento - Pós venda','Relacionamento - Pós venda','Pipeline única da BU Pós Venda','b05a0000-0000-4000-8000-000000000001','outros')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crm_stages (id, clint_id, stage_name, stage_order, color, is_active, origin_id, is_won_stage) VALUES
('b05a0001-0000-4000-8000-000000000001','local-b05a0001-0000-4000-8000-000000000001','Reunião de Viabilidade 1',1,'#3b82f6',true,'b05a0000-0000-4000-8000-000000000002',false),
('b05a0001-0000-4000-8000-000000000002','local-b05a0001-0000-4000-8000-000000000002','Reunião de Viabilidade 2',2,'#8b5cf6',true,'b05a0000-0000-4000-8000-000000000002',false),
('b05a0001-0000-4000-8000-000000000003','local-b05a0001-0000-4000-8000-000000000003','Viabilidade Concluída',3,'#22c55e',true,'b05a0000-0000-4000-8000-000000000002',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bu_catalog (code, label, is_active, sort_order) VALUES ('pos_venda','Pós Venda',true,8) ON CONFLICT (code) DO NOTHING;

INSERT INTO public.bu_origin_mapping (bu, entity_type, entity_id, is_default) VALUES
('pos_venda','group','b05a0000-0000-4000-8000-000000000001',true),
('pos_venda','origin','b05a0000-0000-4000-8000-000000000002',true)
ON CONFLICT (bu, entity_type, entity_id) DO NOTHING;

INSERT INTO public.role_permissions (role, resource, permission_level, bu)
SELECT 'gerente_relacionamento', r, CASE WHEN r IN ('crm','playbook','configuracoes') THEN 'edit' ELSE 'none' END::permission_level, NULL
FROM unnest(ARRAY['crm','playbook','configuracoes','dashboard','receita','custos','relatorios','financeiro','usuarios']) r
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions p WHERE p.role='gerente_relacionamento' AND p.resource=r AND p.bu IS NULL);

-- Gerente de Relacionamento pode mover/editar apenas negócios da pipeline Pós Venda
CREATE POLICY "Gerente relacionamento atualiza deals pos venda" ON public.crm_deals
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'gerente_relacionamento'::app_role) AND origin_id = 'b05a0000-0000-4000-8000-000000000002')
WITH CHECK (public.has_role(auth.uid(),'gerente_relacionamento'::app_role) AND origin_id = 'b05a0000-0000-4000-8000-000000000002');

-- Entregáveis por etapa
CREATE TABLE public.crm_stage_entregaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'pdf',
  obrigatorio boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_stage_entregaveis TO authenticated;
GRANT ALL ON public.crm_stage_entregaveis TO service_role;
ALTER TABLE public.crm_stage_entregaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver entregaveis" ON public.crm_stage_entregaveis FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente_relacionamento'));
CREATE POLICY "Admin gerencia entregaveis" ON public.crm_stage_entregaveis FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.crm_deal_entregaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  entregavel_id uuid NOT NULL REFERENCES public.crm_stage_entregaveis(id) ON DELETE CASCADE,
  arquivo_path text,
  link_url text,
  observacao text,
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_deal_entregaveis_deal ON public.crm_deal_entregaveis(deal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_deal_entregaveis TO authenticated;
GRANT ALL ON public.crm_deal_entregaveis TO service_role;
ALTER TABLE public.crm_deal_entregaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver entregaveis do deal" ON public.crm_deal_entregaveis FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente_relacionamento'));
CREATE POLICY "Enviar entregavel" ON public.crm_deal_entregaveis FOR INSERT TO authenticated
WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente_relacionamento')) AND enviado_por = auth.uid());
CREATE POLICY "Remover entregavel" ON public.crm_deal_entregaveis FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR enviado_por = auth.uid());

CREATE TRIGGER trg_crm_stage_entregaveis_updated BEFORE UPDATE ON public.crm_stage_entregaveis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crm_deal_entregaveis_updated BEFORE UPDATE ON public.crm_deal_entregaveis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.crm_stage_entregaveis (stage_id, titulo, tipo, obrigatorio, ordem) VALUES
('b05a0001-0000-4000-8000-000000000001','PDF da Reunião de Viabilidade 1','pdf',true,1),
('b05a0001-0000-4000-8000-000000000002','PDF da Reunião de Viabilidade 2','pdf',true,1);

-- Trava: só avança de etapa na pipeline Pós Venda com entregáveis obrigatórios anexados
CREATE OR REPLACE FUNCTION public.pos_venda_checar_entregaveis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old int; v_new int; v_faltando text;
BEGIN
  SELECT stage_order INTO v_old FROM crm_stages WHERE id = OLD.stage_id;
  SELECT stage_order INTO v_new FROM crm_stages WHERE id = NEW.stage_id;
  IF v_old IS NULL OR v_new IS NULL OR v_new <= v_old THEN RETURN NEW; END IF;
  SELECT string_agg(e.titulo, ', ') INTO v_faltando
  FROM crm_stage_entregaveis e
  JOIN crm_stages s ON s.id = e.stage_id
  WHERE s.origin_id = NEW.origin_id AND s.stage_order >= v_old AND s.stage_order < v_new
    AND e.obrigatorio AND e.is_active
    AND NOT EXISTS (SELECT 1 FROM crm_deal_entregaveis d WHERE d.deal_id = NEW.id AND d.entregavel_id = e.id);
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Entregável obrigatório pendente: %', v_faltando USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pos_venda_entregaveis BEFORE UPDATE OF stage_id ON public.crm_deals
FOR EACH ROW
WHEN (NEW.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid AND OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.pos_venda_checar_entregaveis();

-- Arquivos dos entregáveis (bucket criado à parte)
CREATE POLICY "pos venda entregaveis ler" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pos-venda-entregaveis' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente_relacionamento')));
CREATE POLICY "pos venda entregaveis enviar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pos-venda-entregaveis' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente_relacionamento')));