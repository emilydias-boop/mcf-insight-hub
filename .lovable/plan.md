

## Auditoria do CRM — Inconsistências e Problemas Encontrados

### Problemas identificados por análise de código

---

### 1. Gráfico "Evolução Diária" mostra dados diários, não acumulados
**Arquivo**: `src/components/sdr/SdrCumulativeChart.tsx` (linhas 15-21)

O componente se chama "SdrCumulativeChart" e o título diz "Evolução Diária", mas plota `row.realized` (valor do dia) e `row.metaDiaria` (meta do dia) — ambos valores pontuais. O correto seria usar `row.accumulated` e `row.metaAccumulated` para mostrar a evolução acumulada, que é muito mais útil para acompanhar progresso vs meta ao longo do mês.

**Correção**: Usar `accumulated` e `metaAccumulated` no chartData, renomear as labels para "Acumulado" e "Meta Acumulada".

---

### 2. KPI "R1 Agendada" ausente nos cards mas presente no funil
**Arquivo**: `src/hooks/useSdrPerformanceData.ts` (linhas 268-300)

O array `metrics` (que alimenta os KPI cards) pula de "Agendamentos" direto para "R1 Realizada", sem mostrar "R1 Agendada". No entanto, o funil (linhas 365-370) tem "R1 Agendada" como step. Isso cria uma desconexão — o gestor vê um número no funil que não aparece como KPI card.

**Correção**: Adicionar KPI card para "R1 Agendada" entre "Agendamentos" e "R1 Realizada".

---

### 3. Novos Leads no funil não faz refetch junto com os outros dados
**Arquivo**: `src/hooks/useSdrPerformanceData.ts` (linhas 448-451)

O `refetch` retornado só chama `detail.refetch()` e `compData.refetch()`, mas não chama `novosLeadsQuery.refetch()`. Quando o usuário clica em atualizar, o número de novos leads pode ficar desatualizado.

**Correção**: Adicionar `novosLeadsQuery.refetch()` ao método refetch.

---

### 4. Meeting click abre drawer limitado que perde dados do MeetingV2
**Arquivo**: `src/pages/crm/SdrMeetingsDetailPage.tsx` (linhas 107-131)

O `handleSelectMeeting` converte `MeetingV2` para `Meeting` (formato antigo), perdendo campos importantes como `attendee_id`, `meeting_slot_id`, `attendee_status`, `booked_at`, `tipo`. O drawer `MeetingDetailsDrawer` recebe dados incompletos.

**Correção**: Usar o drawer `SdrMeetingActionsDrawer` (já existe no componente `SelectedSdrLeadsPanel`) que aceita `MeetingV2` diretamente, ou atualizar o `MeetingDetailsDrawer` para aceitar `MeetingV2`.

---

### 5. "Reuniões Equipe" não está na nav do CRM
**Arquivo**: `src/pages/CRM.tsx` (linhas 21-33)

A rota `/crm/reunioes-equipe` existe no App.tsx (linha 242) como rota top-level, mas NÃO está na navegação lateral do CRM (`CRM.tsx`). Está acessível pela sidebar do app (`AppSidebar.tsx` linha 126) mas não pela nav de tabs do CRM. Isso é intencional (é uma página standalone) mas pode confundir — o usuário na aba CRM não encontra o "Painel Comercial".

**Ação**: Apenas documentar — parece intencional já que está na sidebar global.

---

### 6. Meta de No-Show invertida no cálculo de gap
**Arquivo**: `src/hooks/useSdrPerformanceData.ts` (linhas 284-295)

A meta de no-show está hardcoded em 30% e o `invertGap: true` funciona corretamente para mostrar "abaixo é bom". Porém, o `attainment` calcula `(taxaNoShow / 30) * 100`, o que significa que um SDR com 60% de no-show tem 200% de atingimento — confuso. Para métricas invertidas, o attainment deveria ser invertido também (ex: `(30 - taxaNoShow) / 30 * 100` ou similar).

**Correção**: Ajustar cálculo de attainment para métricas invertidas.

---

### 7. Meta de contratos depende de R1 Realizada real, criando dependência circular
**Arquivo**: `src/hooks/useSdrPerformanceData.ts` (linhas 231-232)

A meta de contratos é `Math.round(r1Realizada_real * 0.3)` — ou seja, a meta muda conforme o SDR realiza mais reuniões. Se o SDR realizou poucas reuniões, a meta fica baixa e ele "bate" fácil. Isso não é necessariamente um bug, mas a meta de contratos nunca é fixa — pode ser confuso.

**Ação**: Documentar ou considerar meta fixa baseada na projeção.

---

## Plano de Correções (por prioridade)

### Fase 1 — Correções críticas de dados
1. **Corrigir gráfico Evolução Diária** — Usar `accumulated`/`metaAccumulated` em `SdrCumulativeChart.tsx`
2. **Adicionar refetch de novosLeads** — Em `useSdrPerformanceData.ts`
3. **Adicionar KPI "R1 Agendada"** — Em `useSdrPerformanceData.ts` no array metrics

### Fase 2 — Melhorias de UX
4. **Corrigir attainment invertido do No-Show** — Em `useSdrPerformanceData.ts`
5. **Melhorar drawer de meeting** — Usar `SdrMeetingActionsDrawer` em vez de converter para formato antigo

### Arquivos afetados
- `src/components/sdr/SdrCumulativeChart.tsx` — Usar dados acumulados
- `src/hooks/useSdrPerformanceData.ts` — Refetch novos leads, KPI R1 Agendada, attainment No-Show
- `src/pages/crm/SdrMeetingsDetailPage.tsx` — Drawer de meeting melhorado

