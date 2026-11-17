revoke execute on function public.auditoria_noshow(date) from authenticated;
revoke execute on function public.auditoria_leads_sem_interacao(date) from authenticated;
revoke execute on function public.auditoria_contato_d0(date) from authenticated;
create policy "Tickets internos negados a usuarios conectados" on public.auditoria_cron_tickets for all to authenticated using (false) with check (false);
create policy "Tickets internos negados a anonimos" on public.auditoria_cron_tickets for all to anon using (false) with check (false);