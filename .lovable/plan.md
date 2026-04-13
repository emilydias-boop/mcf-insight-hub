

## Plano: Incluir leads reembolsados no Faturamento do Closer

### Problema Identificado

O Caio Vasconcelos tem:
- `status: refunded` no attendee
- `contract_paid_at: 2026-04-08` (preenchido)
- `closer_id: Mateus Macedo`

Na aba **Faturamento** do closer, a query busca apenas attendees com `status = 'contract_paid'` (linha 65 do `CloserRevenueTab.tsx`). O Caio tem `status = refunded`, então é excluído — resultando em 0 transações e R$ 0,00.

Na aba **Leads Realizados**, a lógica é mais abrangente: inclui qualquer attendee com `contract_paid_at IS NOT NULL`, independente do status. Por isso o Caio aparece lá (23 contratos) mas não no Faturamento (22 no KPI overview).

### Correção

**Arquivo: `src/components/closer/CloserRevenueTab.tsx`**

Alterar a query de attendees (linha 65) de:
```
.eq('status', 'contract_paid')
```
Para:
```
.not('contract_paid_at', 'is', null)
```

Isso alinha a lógica do Faturamento com a mesma fonte de verdade usada pelo R1CloserMetrics: **`contract_paid_at IS NOT NULL`**, independente do status do attendee. Assim, leads que pagaram e depois reembolsaram (como Caio Vasconcelos) continuarão aparecendo no faturamento do closer.

### Impacto

- Caio Vasconcelos aparecerá na aba Faturamento do Mateus Macedo
- Qualquer outro lead reembolsado com `contract_paid_at` preenchido também será incluído
- Sem alteração no frontend além da query — a tabela já exibe o badge de status corretamente

