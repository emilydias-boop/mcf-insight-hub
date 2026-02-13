
# Corrigir Atribuicao de Vendas e Outside - Bug na Query de Attendees

## Problema Raiz

A query de attendees em `SalesReportPanel.tsx` (linhas 128-144) filtra apenas por `status = 'contract_paid'`:

```
.eq('status', 'contract_paid')
.gte('contract_paid_at', startDate)
```

Isso retorna apenas **317 registros** dos **1.479 attendees** no periodo. Os outros 1.162 (completed, scheduled, no_show) sao ignorados, impedindo:

1. **Match com closer**: Vendas de clientes que tiveram reuniao "completed" nao sao atribuidas ao closer
2. **Outside detection**: Impossivel detectar se a venda foi antes da reuniao se o attendee nao aparece na lista
3. **Resultado visivel**: Apenas 2 outsides detectados (Julio) quando deveria haver dezenas

## Solucao

### Arquivo: `src/components/relatorios/SalesReportPanel.tsx`

Alterar a query de attendees (linhas 128-141) para buscar TODOS os attendees R1 no periodo, sem filtro de status:

**Antes:**
```
.eq('status', 'contract_paid')
.gte('contract_paid_at', startDate)
```

**Depois:**
- Remover `.eq('status', 'contract_paid')` e `.gte('contract_paid_at', startDate)`
- Filtrar por `meeting_slots.scheduled_at` no periodo (usando o filtro `!inner` que ja existe)
- Adicionar `.gte('meeting_slots.scheduled_at', startDate)` e `.lte('meeting_slots.scheduled_at', endDate)`
- Remover filtro de status cancelado para nao perder matches

Tambem expandir o lookback: buscar attendees com `scheduled_at` ate 30 dias ANTES do periodo selecionado, para capturar outsides onde a venda esta no periodo mas a reuniao foi agendada antes.

### Resultado Esperado

- De 317 para ~1.479 attendees disponiveis para matching
- Closers recebem credito por TODAS as vendas de seus clientes (completed, no_show, scheduled)
- Outside detection funciona corretamente: vendas com `sale_date < scheduled_at` aparecem nas colunas Outside
- "Sem closer" diminui significativamente (mais matches encontrados)
