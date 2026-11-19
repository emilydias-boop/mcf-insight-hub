select public.pos_venda_registrar_cliente(h.customer_email, h.customer_phone, h.customer_name, 'A001', h.product_name, coalesce(h.product_price,0), h.sale_date, 'backfill_manual', h.id::text)
from public.hubla_transactions h where h.id='ea5fb9eb-de8d-43ea-9aa5-9d05383a9916';
update public.crm_deals set owner_profile_id='e7b093fe-4407-4f98-b9dc-e9e85e373a48'
where origin_id=(select origin_id from public.crm_deals d join public.crm_origins o on o.id=d.origin_id where o.name ilike '%p%s%venda%' limit 1)
and contact_id in (select id from public.crm_contacts where lower(trim(email))='eng.angelim@gmail.com');