

# Reuniões tab: busca independente do período

## Problema
A aba "Reuniões" usa `perfData.meetings` que vem do hook `useSdrPerformanceData`, que por sua vez busca dados limitados ao período selecionado (startDate/endDate). Mesmo escondendo o filtro de período, os dados continuam limitados.

## Solução

Adicionar uma query independente na aba "Reuniões" usando `useSdrMeetingsFromAgenda` diretamente, sem limite de período (ou com range amplo tipo últimos 12 meses).

### Alterações

**`src/pages/crm/SdrMeetingsDetailPage.tsx`**:
1. Importar `useSdrMeetingsFromAgenda` diretamente
2. Criar uma query separada com range amplo (ex: últimos 6 meses até +1 mês futuro) para a aba de reuniões
3. Na aba "Reuniões", usar `allMeetings` da query independente em vez de `perfData.meetings`
4. O contador no tab header também usa a query independente

```text
// Fluxo atual:
Período → useSdrPerformanceData → perfData.meetings → SdrLeadsTable

// Novo fluxo:
useSdrMeetingsFromAgenda (6 meses) → allMeetings → SdrLeadsTable  (independente)
Período → useSdrPerformanceData → perfData.meetings  (só para Visão Geral)
```

### Detalhes técnicos
- Range da query independente: `subMonths(today, 6)` até `addMonths(today, 1)` — cobre histórico recente e reuniões futuras
- Filtrar por `sdrEmail` usando o campo `intermediador` ou `current_owner` (já funciona no hook)
- A query só é habilitada quando necessário (pode usar `enabled: true` já que o email sempre existe)

### Arquivo
| Arquivo | Ação |
|---------|------|
| `src/pages/crm/SdrMeetingsDetailPage.tsx` | Importar `useSdrMeetingsFromAgenda`, criar query independente, usar na aba Reuniões |

