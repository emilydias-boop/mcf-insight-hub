UPDATE public.crm_stages SET stage_order = stage_order + 1, updated_at = now()
 WHERE origin_id='b05a0000-0000-4000-8000-000000000002' AND stage_order >= 1;

INSERT INTO public.crm_stages (id, clint_id, origin_id, stage_name, stage_order, color, is_active, is_won_stage)
VALUES ('b05a0001-0000-4000-8000-000000000004','pos-venda-backlog','b05a0000-0000-4000-8000-000000000002','Backlog',1,'#94a3b8',true,false);

INSERT INTO public.jornada_mapa_estagios (stage_id, etapa_id)
SELECT 'b05a0001-0000-4000-8000-000000000004', etapa_id FROM public.jornada_mapa_estagios
 WHERE stage_id='b05a0001-0000-4000-8000-000000000000';

CREATE TABLE public.backup_pos_venda_backlog_20261126 (deal_id uuid PRIMARY KEY, stage_id_anterior uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.backup_pos_venda_backlog_20261126 TO service_role;
ALTER TABLE public.backup_pos_venda_backlog_20261126 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente admin le backup backlog" ON public.backup_pos_venda_backlog_20261126 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.backup_pos_venda_backlog_20261126 TO authenticated;

INSERT INTO public.backup_pos_venda_backlog_20261126 (deal_id, stage_id_anterior)
SELECT d.id, d.stage_id FROM public.crm_deals d
 WHERE d.stage_id='b05a0001-0000-4000-8000-000000000001' AND d.data_source='csv'
   AND d.created_at::date='2026-10-08'
   AND NOT EXISTS (SELECT 1 FROM public.pos_venda_reunioes r WHERE r.deal_id=d.id);

UPDATE public.crm_deals d SET stage_id='b05a0001-0000-4000-8000-000000000004', updated_at=now()
 FROM public.backup_pos_venda_backlog_20261126 b WHERE b.deal_id=d.id;

INSERT INTO public.crm_cliente_timeline (contact_id, deal_id, evento, origin_de, origin_para, stage_de, stage_para, nota, metadata)
SELECT d.contact_id, d.id, 'mudanca_etapa', d.origin_id, d.origin_id, b.stage_id_anterior, 'b05a0001-0000-4000-8000-000000000004',
       'Movido para Backlog (separação da carteira migrada)', jsonb_build_object('origem','backlog_20261126')
FROM public.backup_pos_venda_backlog_20261126 b JOIN public.crm_deals d ON d.id=b.deal_id;