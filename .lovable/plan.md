

## Remover trigger quebrado de webhook de saída em `hubla_transactions`

### Resposta direta à sua pergunta

**Não, o trigger não é necessário.** Ele só serve para enfileirar eventos no `outbound_webhook_queue` (a fila que o `outbound-webhook-dispatcher` lê para reenviar vendas para o webhook.site / sistemas externos). A entrada de vendas pela fonte primária (Hubla / Make A010 / Kiwify / MCFPay / Asaas / Manual) **não depende dele**.

Hoje ele está **causando o problema oposto do que deveria**: como está quebrado (`function enqueue_outbound_sale_webhook(uuid, unknown) does not exist`), ele aborta o `INSERT` em `hubla_transactions` inteiro. Foi exatamente isso que derrubou o lead `JOAO VITOR FELISBINO MARTINIANO` — o Make tentou inserir, o trigger explodiu, o insert foi revertido, lead nunca entrou.

### Confirmação técnica

- Trigger ativo: `trg_outbound_sale_webhook AFTER INSERT OR UPDATE` em `hubla_transactions`
- Função usada pelo trigger: `outbound_sale_webhook_trigger()` (migration `20260420133826`)
- Essa função chama `enqueue_outbound_sale_webhook(NEW.id, 'sale.created')` — versão com 2 parâmetros que **não existe** no banco
- A versão que existe é `enqueue_outbound_sale_webhook()` sem parâmetros (migration `20260420131948`), que era a trigger function original
- Resultado: qualquer insert em `hubla_transactions` chama o trigger novo, que tenta usar a função inexistente, e o Postgres aborta tudo
- Lead `JOAO VITOR FELISBINO MARTINIANO` / `anisk1216@gmail.com` confirmado **ausente** de `hubla_transactions`

### Correção (mínima e segura)

Migration única que:

1. **Remove** o trigger quebrado:
   ```sql
   DROP TRIGGER IF EXISTS trg_outbound_sale_webhook ON public.hubla_transactions;
   DROP FUNCTION IF EXISTS public.outbound_sale_webhook_trigger();
   ```
2. **Recria** o trigger usando a função correta original (sem parâmetros), que já contém toda a lógica de filtragem por `events`, `sources` e `product_categories` e enfileira em `outbound_webhook_queue`:
   ```sql
   CREATE TRIGGER trg_outbound_sale_webhook
   AFTER INSERT OR UPDATE ON public.hubla_transactions
   FOR EACH ROW
   EXECUTE FUNCTION public.enqueue_outbound_sale_webhook();
   ```

Isso restaura o comportamento que existia antes da migration `20260420133826` ter quebrado a chamada — o trigger volta a funcionar **sem abortar inserts** e os webhooks de saída voltam a ser enfileirados corretamente para o webhook.site.

### Por que não simplesmente apagar o trigger?

Você poderia. Mas se apagar:
- ❌ O webhook.site para de receber as vendas em tempo real (perde o objetivo do debug que você acabou de configurar)
- ❌ Qualquer integração externa futura via "Webhooks Saída" deixa de funcionar
- ✅ Por outro lado, os inserts voltam a passar (que é o que importa agora)

Recriar o trigger com a função certa resolve **as duas coisas** ao mesmo tempo, com o mesmo trabalho.

### Validação após a correção

1. Reenviar pelo Make o payload do `JOAO VITOR FELISBINO MARTINIANO` (ou esperar próximo lead A010)
2. Confirmar linha em `hubla_transactions` com `customer_email = anisk1216@gmail.com`
3. Confirmar contato/deal criado no `PIPELINE INSIDE SALES`
4. Confirmar item em `outbound_webhook_queue` com `event = sale.created`
5. Confirmar POST chegando no webhook.site em até 30s (próxima execução do dispatcher)

### Escopo

- 1 migration nova (drop + create trigger)
- Zero alteração de código (frontend ou edge function)
- Zero alteração de schema
- Zero impacto em outras tabelas

