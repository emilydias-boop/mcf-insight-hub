

## Plano: Nova lógica de Status do Contrato no Relatório

### Objetivo
Substituir a coluna "Presença R2" por uma coluna "Status" com classificação derivada, e manter a coluna "R2 Status" (status do carrinho) como está.

### Nova lógica de classificação (campo `situacao`)

| Status | Condição |
|--------|----------|
| **Reembolso** | R1 `status = 'refunded'` |
| **No-show** | R2 attendee `status = 'no_show'` |
| **Próxima Semana** | R2 agendado (`invited`/`scheduled`) com `scheduled_at` ≥ sexta-feira 12h (horário de corte) |
| **Agendado** | R2 attendee `status = 'invited'` ou `'scheduled'` (antes do corte) |
| **Pré-agendado** | R2 attendee `status = 'pre_scheduled'` |
| **Pendente** | Tudo que não se encaixa acima (sem R2, ou R2 completed sem classificação terminal) |

**Desistente**: Sugestão — criar um campo `is_desistente` (boolean) no `meeting_slot_attendees` que pode ser marcado manualmente pelo closer/admin. Ou usar um valor no `r2_status_options` existente (ex: criar opção "Desistente"). A segunda opção é mais simples pois não requer migration. Incluirei a lógica para detectar `r2_status_options.name = 'Desistente'` se existir.

### Alterações

**`src/hooks/useContractLifecycleReport.ts`**
- Atualizar tipo `situacao` para: `'reembolso' | 'no_show' | 'proxima_semana' | 'agendado' | 'pre_agendado' | 'desistente' | 'pendente'`
- Lógica de classificação (prioridade):
  1. R1 status `refunded` → reembolso
  2. R2 status `no_show` → no_show
  3. R2 status name `Desistente` → desistente
  4. R2 `invited`/`scheduled` + scheduled_at ≥ sexta 12h → proxima_semana
  5. R2 `invited`/`scheduled` → agendado
  6. R2 `pre_scheduled` → pre_agendado
  7. Else → pendente
- Para "Próxima Semana": calcular sexta-feira da semana atual às 12:00 e comparar com `r2Date`

**`src/components/crm/R2ContractLifecyclePanel.tsx`**
- Substituir coluna "Presença R2" por coluna "Status" usando `situacaoLabel`
- Criar `SituacaoBadge` com cores por tipo:
  - Reembolso: vermelho
  - No-show: vermelho escuro
  - Próxima Semana: verde (como na screenshot)
  - Agendado: azul
  - Pré-agendado: roxo
  - Desistente: cinza
  - Pendente: amarelo/amber
- Atualizar KPIs para refletir nova classificação:
  - Total Pagos, Agendados, Pendentes, No-show, Reembolso
- Atualizar CSV export com novo campo Status
- Remover `AttendanceStatusLabel` (substituído pelo badge de situação)

### Nota sobre Desistente
Usando `r2_status_options` existente: se o closer criar uma opção "Desistente" na configuração de Status R2, o sistema detectará automaticamente. Sem necessidade de migration.

