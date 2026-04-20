create or replace function public.outbound_sale_webhook_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _valid_sources text[] := array['hubla','kiwify','mcfpay','make','asaas','manual'];
  _valid_status  text[] := array['paid','approved','completed','active'];
  _refund_status text[] := array['refunded','chargeback'];
begin
  if (TG_OP = 'INSERT') then
    if NEW.source = ANY(_valid_sources) and NEW.sale_status = ANY(_valid_status) then
      perform public.enqueue_outbound_sale_webhook(NEW.id, 'sale.created');
    end if;
    return NEW;
  end if;

  if (TG_OP = 'UPDATE') then
    if NEW.source = ANY(_valid_sources) then
      if OLD.sale_status = ANY(_valid_status) and NEW.sale_status = ANY(_refund_status) then
        perform public.enqueue_outbound_sale_webhook(NEW.id, 'sale.refunded');
      elsif NEW.sale_status = ANY(_valid_status) and (
        OLD.net_value      is distinct from NEW.net_value or
        OLD.product_price  is distinct from NEW.product_price or
        OLD.sale_status    is distinct from NEW.sale_status or
        OLD.sale_date      is distinct from NEW.sale_date
      ) then
        perform public.enqueue_outbound_sale_webhook(NEW.id, 'sale.updated');
      end if;
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_outbound_sale_webhook on public.hubla_transactions;
create trigger trg_outbound_sale_webhook
  after insert or update on public.hubla_transactions
  for each row execute function public.outbound_sale_webhook_trigger();