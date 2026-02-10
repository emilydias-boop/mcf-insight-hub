

# Adicionar Outside ao Relatório de Vendas (Faturamento por Closer)

## Objetivo

Na tabela "Faturamento por Closer" do Relatório de Vendas, identificar e exibir quais transacoes sao de leads "Outside" (pagaram antes da R1), com contagem e faturamento separados.

## Como funciona hoje

1. `SalesReportPanel` busca attendees com `status = 'contract_paid'` para vincular transacoes a closers
2. `CloserRevenueSummaryTable` agrupa transacoes por closer via matching email/phone
3. Nao ha distincao entre vendas normais e Outside

## Alteracoes

### 1. Expandir query de attendees (`SalesReportPanel.tsx`)

- Adicionar `scheduled_at` no select dos `meeting_slots` (atualmente so traz `closer_id`)
- Atualizar a interface `AttendeeMatch` para incluir `scheduled_at`

### 2. Detectar Outside no `CloserRevenueSummaryTable.tsx`

- Para cada transacao atribuida a um closer, verificar se o `sale_date` da transacao e anterior ao `scheduled_at` da reuniao do attendee correspondente
- Computar por closer: `outsideCount` e `outsideGross`
- Adicionar 2 colunas na tabela: "Outside" (contagem) e "Fat. Outside" (faturamento bruto)

### 3. Propagar para o `CloserRevenueDetailDialog.tsx`

- Adicionar KPI card de "Outside" no dialog de detalhe do closer
- Marcar transacoes Outside com badge na lista de categorias

### Detalhes tecnicos

Interface `AttendeeMatch` atualizada:
```text
meeting_slots: { closer_id: string | null; scheduled_at: string | null } | null;
```

Logica de deteccao (dentro do useMemo de summaryData):
```text
Para cada transacao atribuida a um closer:
  1. Encontrar o attendee que fez o match (via email/phone)
  2. Comparar tx.sale_date < attendee.meeting_slots.scheduled_at
  3. Se sim, contabilizar como Outside
```

### Arquivos modificados
- `src/components/relatorios/SalesReportPanel.tsx` -- expandir select com scheduled_at
- `src/components/relatorios/CloserRevenueSummaryTable.tsx` -- adicionar colunas Outside + Fat. Outside
- `src/components/relatorios/CloserRevenueDetailDialog.tsx` -- adicionar KPI de Outside no dialog

