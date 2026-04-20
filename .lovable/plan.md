

## Cadastrar webhook de saída ativo apontando para webhook.site

### O que será feito

Inserir 1 linha em `outbound_webhook_configs` com a configuração completa, ativa e pronta para receber vendas reais.

### Configuração

| Campo | Valor |
|---|---|
| `name` | `Vendas Reais — Debug webhook.site` |
| `description` | `Webhook de debug apontando para webhook.site. Recebe sale.created, sale.updated e sale.refunded de todas as origens.` |
| `url` | `https://webhook.site/bc01d8da-f2d2-44d0-8a1a-a76a044f0953` |
| `method` | `POST` |
| `headers` | `{"Content-Type": "application/json"}` |
| `events` | `['sale.created', 'sale.updated', 'sale.refunded']` |
| `sources` | `['hubla', 'kiwify', 'mcfpay', 'asaas', 'make', 'manual']` |
| `product_categories` | `null` (todas as categorias) |
| `is_active` | `true` |
| `secret_token` | `null` (debug, sem assinatura) |

### SQL (operação INSERT — usa a ferramenta de inserção de dados)

```sql
INSERT INTO public.outbound_webhook_configs (
  name,
  description,
  url,
  method,
  headers,
  events,
  sources,
  product_categories,
  is_active,
  secret_token
) VALUES (
  'Vendas Reais — Debug webhook.site',
  'Webhook de debug apontando para webhook.site. Recebe sale.created, sale.updated e sale.refunded de todas as origens.',
  'https://webhook.site/bc01d8da-f2d2-44d0-8a1a-a76a044f0953',
  'POST',
  '{"Content-Type": "application/json"}'::jsonb,
  ARRAY['sale.created', 'sale.updated', 'sale.refunded'],
  ARRAY['hubla', 'kiwify', 'mcfpay', 'asaas', 'make', 'manual'],
  NULL,
  true,
  NULL
);
```

### Como validar depois de aplicado

1. Abra a aba do webhook.site no navegador (mesma URL que você gerou) e deixe aberta.
2. Em `/admin/automacoes` → aba **Webhooks Saída** → confira que o webhook `Vendas Reais — Debug webhook.site` aparece ativo.
3. Clique em **Testar** → deve aparecer um payload de exemplo no webhook.site em segundos.
4. Aguarde a próxima venda real entrar (Hubla/Kiwify/MCFPay/Asaas/Make/Manual) → em até 1 min o POST chega no webhook.site.
5. Clique em **Logs** no card do webhook para ver o histórico de envios (status HTTP, duração, payload, erro se houver).

### Escopo

- 1 INSERT em `outbound_webhook_configs`
- Zero alteração de código (frontend ou edge function)
- Zero alteração de schema
- Zero impacto em outros webhooks ou na fila

