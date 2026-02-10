

# Corrigir Fat. Outside: Filtrar por A000 e Somar Todo Faturamento do Lead

## Resumo

Duas correções na lógica de Outside:
1. **Detecção**: Um lead só é "Outside" se tiver uma transação **A000 (Contrato)** com `sale_date` anterior ao `scheduled_at` da R1
2. **Faturamento**: Uma vez identificado como Outside, **todas** as transações desse lead (A000, A001, A009, etc.) contam para "Fat. Outside"

## Lógica detalhada

### Passo 1 - Identificar leads Outside (antes do loop principal)
- Cruzar attendees (com `scheduled_at`) com transações
- Para cada par email/phone, verificar se existe transação onde:
  - `product_name` contém "A000" ou "Contrato" (usando lógica existente em `incorporadorPricing.ts`)
  - `sale_date < scheduled_at`
- Se sim, adicionar email/phone a um Set `outsideLeadEmails` / `outsideLeadPhones`

### Passo 2 - No loop de atribuição de transações
- Se o email/phone da transação pertence ao Set de leads Outside, somar gross ao `outsideGross` do closer
- `outsideCount` = quantidade de leads únicos Outside por closer (não transações)

## Arquivos modificados

### `src/components/relatorios/CloserRevenueSummaryTable.tsx`
- Antes do loop de transações: construir Sets de leads Outside filtrando por A000/Contrato
- No loop: usar os Sets para classificar e somar todo o faturamento do lead
- `outsideCount` passa a ser leads únicos, não transações individuais

### `src/components/relatorios/CloserRevenueDetailDialog.tsx`
- Mesma lógica: identificar leads Outside por A000 antes da R1, somar todas as transações do lead ao KPI de Outside
