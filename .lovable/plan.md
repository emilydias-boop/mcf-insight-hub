

## Diagnostico: Outsides nas Metricas de Closer

### Regra de negocio confirmada

**Para o SDR**: Outside conta como agendamento (o SDR fez o trabalho de agendar).
**Para o Closer**: Outside NAO deve contar em NENHUMA metrica (R1 Agendada, R1 Realizada, No-show). Deve aparecer apenas na coluna "Outside" separada.

### Status atual — onde esta o problema

**1. Painel "Reunioes da Equipe" (`useR1CloserMetrics.ts`):**

| Metrica | Exclui Outside? | Status |
|---------|-----------------|--------|
| R1 Agendada (linha 452-455) | NAO — conta todos com allowedAgendadaStatuses | BUG |
| R1 Realizada (linha 457-466) | SIM para `contract_paid` (verifica isOutside) | PARCIAL — se outside tiver status `completed`, ainda conta |
| No-show (linha 469-471) | NAO — conta todos com `no_show` | BUG |
| Contrato Pago (linha 270-288) | SIM — exclui corretamente | OK |
| Outside (linha 365-387) | N/A — contagem propria | OK |

**2. "Meu Desempenho" do Closer (`useCloserAgendaMetrics.ts`):**

| Metrica | Exclui Outside? | Status |
|---------|-----------------|--------|
| R1 Alocadas (linha 99) | NAO — conta todos non-partner | BUG |
| R1 Realizadas (linha 104) | NAO — conta `completed`/`contract_paid`/`refunded` sem verificar | BUG |
| No-shows (linha 109) | NAO — conta todos `no_show` | BUG |
| Contratos Pagos (linha 157-170) | SIM — exclui outsides | OK |

**3. RPC `get_sdr_metrics_from_agenda` (painel SDR):**
- `contratos` conta por `contract_paid_at` sem verificar se e outside — mas para SDR isso esta CORRETO (outside conta como contrato do SDR)

### Correcao necessaria

**Arquivo 1: `src/hooks/useR1CloserMetrics.ts`**

No loop de processamento de meetings (linha 446+), antes de contar R1 Agendada, R1 Realizada e No-show, verificar se o attendee e outside usando `dealEmailMap` e `emailContractDate` (que ja existem no codigo). Se `contractDate < meetingDate`, pular o attendee dessas 3 metricas.

Mudanca no bloco linhas 446-474: para cada attendee, adicionar check:
```
const email = dealEmailMap.get(att.deal_id);
const isOutsideLead = email && emailContractDate.has(email) && emailContractDate.get(email)! < new Date(meeting.scheduled_at);
if (isOutsideLead) return; // Skip outsides from closer metrics
```

Isso remove outsides de R1 Agendada, R1 Realizada e No-show de uma vez.

**Arquivo 2: `src/hooks/useCloserAgendaMetrics.ts`**

Este hook NAO tem deteccao de outside. Precisa adicionar:
1. Coletar `deal_id`s dos attendees
2. Buscar emails dos deals via `crm_deals` + `crm_contacts`
3. Buscar `hubla_transactions` para encontrar data do contrato mais antigo
4. No loop de contagem (linha 92-113), pular attendees cujo email tem contrato anterior a `slot.scheduled_at`

### Resultado esperado

Todas as metricas do closer (R1 Agendada, R1 Realizada, No-show) passam a excluir outsides. Outsides continuam aparecendo apenas na coluna "Outside" dedicada. A taxa de conversao e no-show refletem apenas leads que o closer realmente atendeu ou deveria ter atendido.

### Arquivos editados
- `src/hooks/useR1CloserMetrics.ts` — Adicionar check de outside no loop de metricas
- `src/hooks/useCloserAgendaMetrics.ts` — Adicionar deteccao de outside e excluir de r1_alocadas, r1_realizadas, no_shows

### O que NAO muda
- RPC `get_sdr_metrics_from_agenda` (SDR metrics — outside conta como agendamento/contrato para SDR)
- Contagem de `contrato_pago` e `outside` (ja estao corretos)
- `CloserSummaryTable` e `SdrSummaryTable` (consomem dados dos hooks)

