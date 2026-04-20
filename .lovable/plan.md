

## Diagnóstico

A infraestrutura foi criada quase toda — tabelas (`outbound_webhook_configs`, `outbound_webhook_queue`, `outbound_webhook_logs`), funções de payload (`build_sale_webhook_payload`), enqueue (`enqueue_outbound_sale_webhook`), edge functions (`outbound-webhook-dispatcher`, `outbound-webhook-test`), cron rodando a cada minuto, e UI nas abas Webhooks Entrada/Saída.

**Falta apenas a peça que conecta tudo:** o **trigger em `hubla_transactions`** que detecta vendas e chama `enqueue_outbound_sale_webhook`. Sem ele, nenhuma venda é enfileirada e o dispatcher fica rodando sobre fila vazia.

## Correção (1 migration)

Criar a função de trigger + o próprio trigger em `hubla_transactions`:

```sql
-- 1) Função de trigger
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
  -- INSERT: nova venda válida
  if (TG_OP = 'INSERT') then
    if NEW.source = ANY(_valid_sources) and NEW.sale_status = ANY(_valid_status) then
      perform public.enqueue_outbound_sale_webhook(NEW.id, 'sale.created');
    end if;
    return NEW;
  end if;

  -- UPDATE: detectar mudanças relevantes
  if (TG_OP = 'UPDATE') then
    if NEW.source = ANY(_valid_sources) then
      -- transição para refund
      if OLD.sale_status = ANY(_valid_status) and NEW.sale_status = ANY(_refund_status) then
        perform public.enqueue_outbound_sale_webhook(NEW.id, 'sale.refunded');
      -- mudança em valor / status / data
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

-- 2) Trigger
drop trigger if exists trg_outbound_sale_webhook on public.hubla_transactions;
create trigger trg_outbound_sale_webhook
  after insert or update on public.hubla_transactions
  for each row execute function public.outbound_sale_webhook_trigger();
```

## O que isso resolve

| Antes | Depois |
|---|---|
| Cria webhook na UI, ativa, mas nunca recebe nada | Toda venda nova/atualizada/reembolsada cai na fila |
| Fila `outbound_webhook_queue` sempre vazia | Dispatcher processa em até 1min e faz POST na URL |
| Botão "Testar" funciona (envia payload de exemplo) | Botão "Testar" continua funcionando + agora dispara real |

## Como validar depois de aplicar

1. Em `/admin/automacoes` → aba **Webhooks Saída**, criar webhook apontando para um endpoint de teste (ex: webhook.site).
2. Marcar evento `sale.created`, deixar todas as sources ligadas, ativar.
3. Clicar **Testar** → deve chegar payload de exemplo no destino.
4. Aguardar próxima venda real entrar via Hubla/Kiwify/MCFPay → em até 1 min o POST chega no destino.
5. Conferir histórico no botão **Logs** do webhook.

## Escopo

- 1 migration (1 função + 1 trigger)
- Zero alteração em código frontend
- Zero alteração em edge functions
- Zero impacto em transações existentes (trigger só dispara em novas operações)

