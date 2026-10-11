do $$
declare r record;
begin
for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname = any(array['generate_indicacao_parcelas','recalc_hubla_cart_row','reconcile_hubla_clint_ids','export_all_contacts_page','get_all_hubla_transactions','get_hubla_transactions_by_bu','get_mcf_pay_codes_for_deal','get_vendas_do_participante','get_vendas_sem_vinculo','get_vendas_diretas_do_participante','get_vendas_diretas_sem_vinculo','operacional_incorporador_comissoes','sugerir_vinculo_contrato','tv_consorcio_contratos','venda_direta_closer_ok','vendas_diretas_efetivas'])
loop
 execute format('revoke execute on function %s from public, anon', r.sig);
 execute format('grant execute on function %s to authenticated, service_role', r.sig);
end loop;
end $$;