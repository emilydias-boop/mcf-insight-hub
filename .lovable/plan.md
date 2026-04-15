

## Plano: Relatório de Acompanhamento de Contratos Pagos

### Objetivo
Substituir o conteúdo atual da aba "Relatório" (qualificação por estado/renda/profissão) por um painel focado no **ciclo de vida dos contratos pagos**: onde cada contrato está no funil, se passou por R2, se tem status no carrinho, qual a safra prevista, e se ficou parado em alguma etapa.

### Dados disponíveis (já existem no banco)
Da tabela `meeting_slot_attendees` + `meeting_slots`:
- `contract_paid_at` — data do pagamento
- `status` — attendee status (scheduled/completed/no_show/contract_paid)
- `r2_status_id` — Aprovado/Reprovado/Pendente/Em Análise/Próxima Semana/etc.
- `carrinho_week_start` — safra atribuída
- `carrinho_status` — status no carrinho
- `meeting_slots.scheduled_at` — data da R2
- `meeting_slots.closer_id` → closer R2

Cruzando com R1 via `deal_id` + outro attendee em `meeting_type = 'r1'`:
- Data da R1, closer R1, status R1

### Estrutura do novo painel

**1. Filtros (mantém estrutura atual)**
- Período (date range) — filtra por `contract_paid_at`
- Closer R1 (opcional)
- Status do funil (filtro por situação derivada)

**2. KPIs resumo**
- Total de contratos pagos no período
- Com R2 Agendada / Sem R2 Agendada
- Com status carrinho (Aprovado/Reprovado/Pendente) / Sem status
- Parados (contrato pago mas sem movimentação R2)

**3. Tabela principal (foco inicial)**
Colunas:
| Lead | Contrato Pago Em | Closer R1 | R1 Data | R1 Status | R2 Agendada? | R2 Data | Closer R2 | R2 Status | Status Carrinho | Safra (semana) | Situação |

Onde **Situação** é um campo derivado:
- `✅ Completo` — tem R2 + status aprovado/reprovado
- `⏳ Aguardando R2` — contrato pago, sem R2 agendada
- `⚠️ Sem Status` — tem R2 mas sem r2_status_id
- `🔄 Pendente` — tem R2 com status Pendente/Em Análise
- `🚫 Parado` — contrato pago há X dias sem nenhuma movimentação

**4. Gráficos (fase 2, não agora)**
- Serão adicionados depois da tabela validada

### Implementação técnica

**Arquivo 1: `src/hooks/useContractLifecycleReport.ts`** (novo)
- Hook que busca attendees com `contract_paid_at IS NOT NULL` no período
- Join com `meeting_slots` (R1 e R2 via deal_id)
- Join com `r2_status_options` para nome do status
- Join com `closers` para nomes
- Retorna array tipado com todos os campos da tabela

**Arquivo 2: `src/components/crm/R2ContractLifecyclePanel.tsx`** (novo)
- Substitui `R2QualificationReportPanel` na aba Relatório
- Filtros + KPIs + tabela com ScrollArea
- Export Excel com todas as colunas
- Botão Copiar

**Arquivo 3: `src/pages/crm/AgendaR2.tsx`**
- Trocar `<R2QualificationReportPanel />` por `<R2ContractLifecyclePanel />`

**Arquivo 4: `src/components/crm/R2QualificationReportPanel.tsx`**
- Mantido intacto (não deletado), apenas deixa de ser usado na aba

### Query principal (simplificada)
```sql
-- Attendees com contrato pago no período
SELECT att.*, ms.scheduled_at as r2_date, ms.closer_id,
       r2s.name as r2_status_name,
       -- R1 info via subquery no deal_id
FROM meeting_slot_attendees att
JOIN meeting_slots ms ON att.meeting_slot_id = ms.id AND ms.meeting_type = 'r2'
LEFT JOIN r2_status_options r2s ON att.r2_status_id = r2s.id
WHERE att.contract_paid_at BETWEEN start AND end
  AND att.is_partner = false
  AND att.status != 'cancelled'
```

Para R1: busca separada por `deal_id` em attendees de `meeting_type = 'r1'`.

