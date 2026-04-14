

## Plano: Alinhar números do relatório com os dashboards

### Diagnóstico

Investiguei os dados diretamente no banco e encontrei 3 causas raiz:

| Métrica | Relatório | Dashboard | Causa |
|---------|-----------|-----------|-------|
| R1 Agendadas | 247 | 293 | Edge function calcula datas erradas e exclui `rescheduled` |
| R1 No-Show | 85 | 94 | Mesmo problema de range de datas |
| R2 Agendadas | 41 | 52 | Boundaries do carrinho não usam a semana correta (weekStart = Thu Apr 9) |

### Causa raiz principal: cálculo de datas

O dashboard usa `AT TIME ZONE 'America/Sao_Paulo'` para converter datas (via RPC `get_sdr_meetings_from_agenda`), enquanto a edge function usa offsets manuais em UTC que produzem ranges diferentes. Além disso, o dashboard `useR1CloserMetrics` inclui `rescheduled` nas agendadas (via `allowedAgendadaStatuses`), mas a edge function exclui.

**Verificação no banco:**
- Sat 5/Apr → Fri 11/Apr (BRT dates), BU incorporador: **293 total** (120 completed + 103 no_show + 58 contract_paid + 6 invited + 3 rescheduled + 2 sem_sucesso + 1 refunded) ✓

### Correções em `supabase/functions/weekly-manager-report/index.ts`

**1. Usar semana Sáb-Sex correta (mesma lógica de `getCustomWeekStart`)**

Substituir `getIncorpPeriods()` para calcular:
- carrinhoWeek: Sáb → Sex (mesma lógica de `getCustomWeekStart` do dashboard)
- safraContratos: Qui → Qua (Sáb - 2 → Sex - 2)
- Usar `AT TIME ZONE` no SQL ou calcular boundaries BRT com mais precisão

**2. R1 — incluir `rescheduled` em agendadas (como o dashboard faz)**

Atualmente o código faz:
```
if (att.status !== 'cancelled' && att.status !== 'rescheduled') r1Agendadas++
```
Mudar para incluir rescheduled (consistente com `allowedAgendadaStatuses` do `useR1CloserMetrics`):
```
if (att.status !== 'cancelled') r1Agendadas++
```

**3. R1 — buscar closers dinamicamente em vez de hardcoded**

Substituir `R1_CLOSER_IDS` constante por query dinâmica:
```sql
SELECT id, name FROM closers WHERE bu = 'incorporador' AND is_active = true AND (meeting_type IS NULL OR meeting_type = 'r1')
```
Isso garante que novos closers (ex: William Ferreira) sejam incluídos automaticamente.

**4. R2 — usar weekStart correto do carrinho (Thu, não Sat)**

O carrinho R2 usa `weekStart = Thursday` (config key `carrinho_config_2026-04-09`). A edge function precisa:
- Calcular o Thursday da semana anterior como weekStart do carrinho
- Buscar `carrinho_config_{weekStart}` para obter cutoff times
- currentFriday = weekStart + 1 dia
- previousFriday = currentFriday - 7 dias
- R2 range: previousFriday@prevCutoff → currentFriday@currCutoff
- Incluir encaixados via `carrinho_week_start = weekStart`

**5. R2 — buscar closers R2 dinamicamente também**

Substituir `R2_CLOSER_IDS` por query:
```sql
SELECT id, name FROM closers WHERE bu = 'incorporador' AND is_active = true AND meeting_type = 'r2'
```

### Resultado esperado (semana carrinho 09/04)

- R1: 293 agendadas, ~153 realizadas, ~94 no-shows (Sáb 05 → Sex 11)
- R2: 52 agendadas, 45 realizadas, 35 aprovados, 3 próxima semana, 2 fora
- Contratos: 41 total, 3 recorrências, 38 com reembolso, 11 reembolsos, 27 líquidos ✓

