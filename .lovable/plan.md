

## Remover Transações "Make" a Partir de Abril/2026

### Contexto

Transações com `source = 'make'` são duplicatas de vendas que já chegam via Hubla, Kiwify ou Asaas individualmente. A deduplicação atual por email/data falha quando o cliente usa emails diferentes. Em vez de continuar refinando a deduplicação, a solução é simplesmente **excluir make do mês atual em diante**, mantendo o histórico intacto.

Dados: 32 transações make em abril/2026 que serão excluídas.

### Correção

**1. Migration SQL** — Adicionar filtro de data nas 3 RPCs:

| RPC | Mudança |
|---|---|
| `get_all_hubla_transactions` | Adicionar `AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01')` |
| `get_hubla_transactions_by_bu` | Mesmo filtro |
| `get_first_transaction_ids` | Mesmo filtro |

Isso remove `'make'` da lista de sources permitidos **apenas para transações de abril em diante**. Transações make anteriores a abril continuam aparecendo normalmente com toda a lógica de deduplicação existente.

### Detalhes técnicos

```sql
-- Em cada RPC, trocar:
AND ht.source IN ('hubla', 'manual', 'make', 'mcfpay', 'kiwify')

-- Por:
AND ht.source IN ('hubla', 'manual', 'make', 'mcfpay', 'kiwify')
AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00')
```

A lógica de deduplicação make existente (NOT EXISTS por email/data) continua funcionando para o histórico anterior a abril.

### Arquivo afetado
- **Nova migration SQL** — Recria as 3 RPCs com o filtro de corte temporal para `source = 'make'`

