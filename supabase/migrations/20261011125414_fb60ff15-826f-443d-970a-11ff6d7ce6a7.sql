DO $$
DECLARE
  t text;
  backup_tables text[] := ARRAY[
    'backfill_reembolso_contrato_fila',
    'backup_a005_hubla_eco_restaurado',
    'backup_contrato_pago_movido',
    'backup_effective_from_a001_a009',
    'backup_fusao_homonimo',
    'backup_liquido_juros_carrinho',
    'backup_liquido_juros_parcelamento',
    'backup_liquido_x100_nov2025',
    'backup_nome_produto_normalizado',
    'backup_nome_renomeado_por_comprador',
    'backup_parceria_backfill_venda_realizada',
    'backup_recompra_a010_reativada',
    'backup_reembolso_contrato_deals',
    'backup_reembolso_contrato_msa',
    'backup_venda_direta_backfill_set2026',
    'bkp_cota_contratada_backfill'
  ];
BEGIN
  FOREACH t IN ARRAY backup_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))',
      'admin_only_select_' || t, t
    );
  END LOOP;
END $$;