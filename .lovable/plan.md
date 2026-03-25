

## Diferença de 39 vs 34 contratos: Fontes de dados diferentes

### Diagnóstico
- **Vendas (39)**: Busca de `hubla_transactions` filtrando por `product_name = "A000 - Contrato"` e `sale_status = "paid/completed"`. Inclui TODAS as vendas da Hubla.
- **Controle Diego (34)**: Busca de `meeting_slot_attendees` com `contract_paid_at IS NOT NULL`. Só inclui contratos que têm um **attendee vinculado a uma reunião**.

Os ~5 contratos que faltam são vendas na Hubla onde `linked_attendee_id = null` (visível nos dados de rede), ou seja, contratos pagos sem reunião agendada (compra direta, fora do funil de R1).

### Solução
Complementar o `useContractReport` buscando também as transações Hubla A000 do período que **não** possuem `linked_attendee_id`, e adicioná-las como linhas extras no relatório do Controle Diego. Isso garante que todos os contratos pagos apareçam, mesmo sem reunião.

### Alterações

#### 1. `src/hooks/useContractReport.ts`
Após a query principal de `meeting_slot_attendees`, fazer uma query secundária:

```typescript
// Buscar transações Hubla A000 no período que não têm linked_attendee_id
const { data: unlinkedHubla } = await supabase
  .from('hubla_transactions')
  .select('id, sale_date, customer_name, customer_email, customer_phone, product_name, net_value, source')
  .or('product_name.ilike.%a000%,product_name.ilike.%contrato%')
  .eq('sale_status', 'completed')
  .is('linked_attendee_id', null)
  .gte('sale_date', startISO)
  .lte('sale_date', endISO);
```

- Mapear essas transações como `ContractReportRow` com campos default (closerName: "Sem Reunião", sdrName: "N/A", meetingType: "direct", etc.)
- Concatenar ao resultado principal e retornar tudo ordenado por data

#### 2. `src/components/relatorios/ControleDiegoPanel.tsx`
- Sem alteração de lógica necessária (os novos rows terão a mesma interface `KanbanRow`)
- Os cards sem reunião aparecerão normalmente no Kanban como "Pendentes" com indicação visual de "Compra Direta" (sem closer/SDR)

### Resultado
O total de contratos no Controle Diego passará a bater com o total de Vendas, pois ambos usarão a mesma base de dados (Hubla) como fonte de verdade complementar.

