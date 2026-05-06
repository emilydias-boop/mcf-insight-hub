## Problema

No `/crm/reunioes-equipe`, o card **CONTRATOS = 7** é clicável e abre o modal "Contratos pagos", mas a lista mostra **0 lead(s) — "Nenhum lead encontrado neste bucket."**.

## Causa raiz

O número do KPI e o filtro do drilldown usam fontes diferentes:

- **KPI (7)** → `enrichedKPIs.totalContratos`, que conta attendees com `contract_paid_at` dentro do período (mesma lógica de `get_sdr_metrics_from_agenda`).
- **Drilldown** → `KpiDrillDownDialog`, no `case "contratos"`, filtra apenas por `m.status_atual` contendo "contrato pago" / "proposta fechada" — ou seja, pela **stage atual do deal**, e **sem aplicar janela de período**.

Resultado: leads cuja R1 ocorreu fora do mês, ou cuja stage do deal já mudou, ou cujo `status_atual` no array `allMeetings` não foi materializado como "Contrato Pago", **não aparecem**, mesmo tendo `contract_paid_at` no período.

Confirmações no código:
- `src/components/sdr/KpiDrillDownDialog.tsx` linhas 166–169 e 209–210: `isContratoStage(m.status_atual)` e `case "contratos": return isContratoStage(m.status_atual);` — sem `inRange(...)` e sem olhar `attendee_status`/`contract_paid_at`.
- `src/components/sdr/TeamKPICards.tsx` linhas 140–149: o card usa `kpis.totalContratos` (contagem por `contract_paid_at`).
- `src/pages/crm/ReunioesEquipe.tsx` linha 863: o dialog recebe `allMeetings`, que vem do `useTeamMeetingsData` filtrado por `scheduled_at` no período.

## Correção

Alinhar o bucket `"contratos"` à mesma regra do KPI: contar/listar attendees cujo **contrato foi pago dentro do período**, independente de quando a R1 foi marcada.

### 1. `src/components/sdr/KpiDrillDownDialog.tsx`
- Trocar a regra do `case "contratos"` em `filterByBucket`:
  - Antes: `return isContratoStage(m.status_atual);`
  - Depois: filtrar por reuniões cujo `attendee_status === 'contract_paid'` **ou** `attendee_status === 'refunded'` **e** com `contract_paid_at` dentro de `[startDate, endDate]`. Como `MeetingV2` ainda não expõe `contract_paid_at`, usar fallback: se `attendee_status` for contract_paid/refunded e a reunião estiver no período via `scheduled_at`, incluir; caso contrário, ler de campo novo opcional `contract_paid_at` quando disponível.
- Atualizar o label do bucket para deixar claro que é por data de pagamento ("Contratos pagos no período (por data de pagamento)").

### 2. `src/hooks/useSdrMetricsV2.ts` (interface `MeetingV2`)
- Adicionar campo opcional `contract_paid_at?: string | null` para que o drilldown possa filtrar pela data correta. A RPC `get_sdr_meetings_from_agenda` já tem esse dado por attendee — basta projetá-lo no resultado.

### 3. `src/pages/crm/ReunioesEquipe.tsx`
- Garantir que o `allMeetings` passado ao dialog inclua attendees com `contract_paid_at` no período, mesmo que `scheduled_at` esteja fora da janela. Hoje `useTeamMeetingsData` filtra por `scheduled_at`. Para o bucket de contratos é preciso uma fonte adicional: ou estender o hook para incluir esses attendees, ou passar uma lista paralela `meetingsContratos` ao dialog (similar ao que já é feito com `meetingsRaw` para no-show e `pendentesOverride` para pendentes).

### 4. RPC (apenas se necessário)
- Se `get_sdr_meetings_from_agenda` ainda não retornar `contract_paid_at`, adicionar esse campo ao SELECT (mudança não destrutiva). Caso já retorne, basta tipar e propagar no front.

## Resultado esperado

Card **CONTRATOS 7** ↔ modal lista exatamente **7 leads**, mostrando lead, telefone, SDR (intermediador), closer, data agendada e badge "Contrato Pago". Funciona inclusive para contratos pagos no mês cuja R1 ocorreu em meses anteriores (caso típico do Josias Rabelo Junior já corrigido).

## Detalhes técnicos

- Fonte de verdade dos KPIs: `get_sdr_metrics_from_agenda` (conta `contract_paid_at` no mês, `meeting_type='r1'`, `is_partner=false`, `status<>'cancelled'`, `booked_by=profile`).
- A correção espelha exatamente essa regra no front-end do drilldown.
- Não envolve mudanças em RLS nem em lógica de comissão; é apenas alinhamento de visualização.
- Reaproveita o padrão já usado para `no_show`/`pendentes` (fontes paralelas via props `meetingsRaw` / `pendentesOverride`).
