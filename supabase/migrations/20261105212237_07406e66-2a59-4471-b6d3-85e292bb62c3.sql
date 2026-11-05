DO $migration$
DECLARE
  v_sql text;
  v_old text;
  v_new text;
BEGIN
  v_sql := pg_get_functiondef('public.kanban_resumo_lote(uuid[])'::regprocedure);
  v_old := 'select x.id, x.stage_id from public.crm_deals x';
  v_new := 'select x.id, x.stage_id, x.origin_id from public.crm_deals x';
  IF strpos(v_sql, v_old) = 0 THEN RAISE EXCEPTION 'Definição inesperada de kanban_resumo_lote (d)'; END IF;
  v_sql := replace(v_sql, v_old, v_new);
  v_old := '  wm as (select x.deal_id, x.n, x.ult from kanban_priv.wa_manual_por_deal(p_ids) x),';
  v_new := $patch$  pv as (
    select a.deal_id,
           max(a.created_at) filter (where a.activity_type = 'pos_venda_nota_contato' and nullif(btrim(a.description), '') is not null) nota_em,
           max(a.created_at) filter (where a.activity_type = 'stage_change' and (
             (nullif(a.metadata->>'from_stage_id', '') is not null and nullif(a.metadata->>'to_stage_id', '') is not null and a.metadata->>'from_stage_id' <> a.metadata->>'to_stage_id')
             or (nullif(btrim(a.from_stage), '') is not null and nullif(btrim(a.to_stage), '') is not null and a.from_stage <> a.to_stage)
           )) mudanca_em
      from public.deal_activities a
      join d on d.id::text = a.deal_id and d.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid
     where a.activity_type in ('pos_venda_nota_contato', 'stage_change')
     group by a.deal_id
  ),
  wm as (select x.deal_id, x.n, x.ult from kanban_priv.wa_manual_por_deal(p_ids) x),$patch$;
  IF strpos(v_sql, v_old) = 0 THEN RAISE EXCEPTION 'Definição inesperada de kanban_resumo_lote (wm)'; END IF;
  v_sql := replace(v_sql, v_old, v_new);
  v_sql := replace(v_sql, 'j as (select d.id,', 'j as (select d.id, d.origin_id, pv.nota_em, pv.mudanca_em,');
  v_sql := replace(v_sql, 'left join tw on tw.deal_id = d.id', 'left join pv on pv.deal_id = d.id::text left join tw on tw.deal_id = d.id');
  v_old := $patch$'lastTouchAt', j.toque,$patch$;
  v_new := $patch$'lastTouchAt', case when j.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid then
      case when j.nota_em is not null and j.mudanca_em is not null then greatest(j.toque, j.nota_em, j.mudanca_em) else null end
      else j.toque end,
    'posVendaNotaEm', j.nota_em,
    'posVendaMudancaEm', j.mudanca_em,
    'posVendaContatoConfirmado', case when j.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid then j.nota_em is not null and j.mudanca_em is not null else null end,$patch$;
  IF strpos(v_sql, v_old) = 0 THEN RAISE EXCEPTION 'Definição inesperada de kanban_resumo_lote (toque)'; END IF;
  v_sql := replace(v_sql, v_old, v_new);
  EXECUTE v_sql;

  -- Mesmo critério no filtro de inatividade, sem alterar ligações ou contagens reais.
  v_sql := pg_get_functiondef('public.kanban_filtrados(uuid[],jsonb,uuid,text,uuid[],boolean)'::regprocedure);
  v_old := 'd.created_at as criado_em, c.email, d.tags, d.custom_fields';
  IF strpos(v_sql, v_old) = 0 THEN RAISE EXCEPTION 'Definição inesperada de kanban_filtrados (b)'; END IF;
  v_sql := replace(v_sql, v_old, 'd.created_at as criado_em, c.email, d.tags, d.custom_fields, d.origin_id');
  v_old := '    m as (select b.id,';
  v_new := $patch$    pv as (
      select a.deal_id,
             max(a.created_at) filter (where a.activity_type = 'pos_venda_nota_contato' and nullif(btrim(a.description), '') is not null) nota_em,
             max(a.created_at) filter (where a.activity_type = 'stage_change' and (
               (nullif(a.metadata->>'from_stage_id', '') is not null and nullif(a.metadata->>'to_stage_id', '') is not null and a.metadata->>'from_stage_id' <> a.metadata->>'to_stage_id')
               or (nullif(btrim(a.from_stage), '') is not null and nullif(btrim(a.to_stage), '') is not null and a.from_stage <> a.to_stage)
             )) mudanca_em
        from public.deal_activities a
        join b on b.id::text = a.deal_id and b.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid
       where a.activity_type in ('pos_venda_nota_contato', 'stage_change')
       group by a.deal_id
    ),
    m as (select b.id,$patch$;
  IF strpos(v_sql, v_old) = 0 THEN RAISE EXCEPTION 'Definição inesperada de kanban_filtrados (m)'; END IF;
  v_sql := replace(v_sql, v_old, v_new);
  v_old := 'greatest(tw.ult, da.toque_ult, wa.ult) as ultimo_toque';
  v_new := $patch$case when b.origin_id = 'b05a0000-0000-4000-8000-000000000002'::uuid then
                   case when pv.nota_em is not null and pv.mudanca_em is not null then greatest(tw.ult, da.toque_ult, wa.ult, pv.nota_em, pv.mudanca_em) else null end
                   else greatest(tw.ult, da.toque_ult, wa.ult) end as ultimo_toque$patch$;
  IF strpos(v_sql, v_old) = 0 THEN RAISE EXCEPTION 'Definição inesperada de kanban_filtrados (toque)'; END IF;
  v_sql := replace(v_sql, v_old, v_new);
  v_sql := replace(v_sql, 'from b left join tw on tw.deal_id = b.id', 'from b left join pv on pv.deal_id = b.id::text left join tw on tw.deal_id = b.id');
  EXECUTE v_sql;
END
$migration$;