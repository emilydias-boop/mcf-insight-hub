# Auditoria somente-leitura — confiabilidade de "reuniões qualificadas realizadas" e "conversão" no funil 50K

Janela medida: últimos 30 dias (02/08/2026 → 01/09/2026, dados reais do banco). Nada foi alterado.

## 1. Identificação do funil 50K

Não existe origin, grupo ou pipeline chamado "MCF 50K/Construção". O 50K é **produto**, vendido dentro do funil comercial do incorporador:

- BU `incorporador` → origin default **PIPELINE INSIDE SALES** (`e3c04f21-ba2c-4c66-84f8-b4341c826b1c`, grupo "Perpétuo - X1", 24.304 deals) + origin secundária "PILOTO ANAMNESE / INDICAÇÃO".
- Produtos 50K identificados nas vendas: `A001 - MCF INCORPORADOR COMPLETO`, `A009 - ... + THE CLUB`, `A005 - MCF P2` (segundo pagamento), com ofertas explícitas como "Incorporador 50k + The Club (17k à vista)".
- Existem origins órfãs com nome 50K e **zero deals**: "50K -> AL", "PIPELINE AL -> 50K", grupo "R - R001 - Incorporador Completo 50K". Não são funil operacional.

Stages ativos do PIPELINE INSIDE SALES (`crm_stages`, 19): ANAMNESE COMPLETA (0), Lead Gratuito (1), Lead Instagram (2), A017 - Novo Lead (3), A010 Em Aberto (5), Novo Lead (6), Em contato (7), Lead Qualificado (8), No-Show R2 (9), Reunião 01 Agendada (9), No-Show (10), Sem Interesse (11), Reunião 01 Realizada (12), Follow-up Closer (13), Contrato Pago (14), Reunião 02 Agendada (15), Reunião 02 Realizada (16), Venda realizada (17). Inativo: LEAD GUIA.

Ruído estrutural medido: a mesma origin tem **17 stages paralelos em `local_pipeline_stages`** (fonte que o `useCRMStages` prioriza), e há deals parados em stages que não existem na lista ativa: `NOVO LEAD ( FORM )`, `Perdido`, `SEM SUCESSO`. Duas ordens 9 empatadas (No-Show R2 e Reunião 01 Agendada).

## 2. Agendamentos (30 dias)

- Total de slots do funil: **712** (r1 + r2). R1: **501**.
- R1 por semana (início segunda): 03/08 = 103 · 10/08 = 117 · 17/08 = 118 · 24/08 = 130 · 31/08 = 33 (semana parcial).
- Excluindo `canceled` (44) e `rescheduled` (9): 93 · 107 · 104 · 114 · 30.
- `source` de 100% dos slots da janela = **`manual`** — nenhum agendamento via Calendly na janela.

Fluxos que criam slot: `useCloserScheduling`, `QualificationAndScheduleModal`/`QuickScheduleModal`, `MoveEntireMeetingModal`, `MoveAttendeeModal`, `useR2AgendaData`, `useTransferR2Attendee`, edge functions `create-manual-approved-lead`, `calendly-create-event`, `calendly-webhook-handler`, `google-calendar-sync`.

Reunião que acontece sem registro: possível por construção — todo registro depende de ação humana no CRM (nenhum gatilho automático a partir de WhatsApp/telefone/Meet). **Quantas ocorreram: não determinei** — não há fonte independente (não existe log de call/Meet reconciliado com slot) para medir o buraco.

## 3. Reuniões realizadas — dois predicados concorrentes, também no 50K

O código usa simultaneamente `meeting_slots.status` e `meeting_slot_attendees.status`, com variações (`useChannelFunnelReport`: `slotStatus==='completed' || attStatus==='completed'`; em outro trecho também aceita `contract_paid` e `refunded`).

Medição em R1 do funil, 30 dias, deals distintos:

| Predicado | Deals "realizada" |
|---|---|
| attendee.status = completed | 253 |
| attendee.status in (completed, contract_paid) | 347 |
| + refunded | 347 |
| slot.status = completed | 280 |
| união (slot OU attendee) | **352** |

Contradições: **136** deals com slot `completed` e attendee **não** realizado; **81** com attendee realizado e slot **não** `completed`. Spread total 253 → 352 = **39% de variação** no mesmo mês.

Contradições contra o stage do deal: **6** deals com attendee realizado mas stage atrasado (Novo Lead / Em contato / Lead Qualificado / R1 Agendada); **2** com attendee realizado e deal em No-Show; **16** deals em stage avançado (R1 Realizada → Venda realizada) **sem** nenhum attendee marcado como realizado.

Sobre "qualificada": não existe campo de reunião qualificada. A qualificação pré-R1 fica em `crm_deals.custom_fields` (`qualification_saved`/`qualification_answers`) e cobre **445 de 454** deals com R1 na janela (98%). Ela é do **deal**, não da reunião — reagendamento/2ª R1 não reavalia. `lead_type` (A/B/C) está **nulo em 177 dos 712** slots.

## 4. Vendas / conversão — sem evento único

Quatro fontes concorrentes na janela:

| Fonte | Contagem 30d |
|---|---|
| Hubla A001/A005/A009 `completed` (linhas) | 262 |
| Hubla, e-mails únicos | **144** (R$ 2.061.105 líquido) |
| `attendee.contract_paid_at` na janela | 230 |
| `deal_activities.to_stage = 'Contrato Pago'` | 139 |
| `deal_activities.to_stage = 'Venda realizada'` | 46 |

Rastreabilidade Hubla → CRM está quebrada: das 262 linhas, **259 sem `linked_deal_id`**, 262 sem `linked_attendee_id`, e apenas **3** vinculadas a um deal do Inside Sales. A conciliação hoje é por e-mail/telefone no relatório, não por vínculo persistido. Reembolsos no período: 1.

Conversão medida, conforme o par escolhido: 230/347 = **66%** · 144/352 = **41%** · 46/280 = **16%**. Ou seja, a mesma performance mensal pode ser apresentada entre 16% e 66%.

## 5. Qualidade (30 dias, funil 50K)

- No-shows: 359 linhas de attendee / 304 deals distintos.
- `no_show_validations` no período: **60** — cobertura de ~17% dos no-shows (por regra, evidência+IA só se aplica a SDR; Closer marca direto).
- Tentativas bloqueadas de no-show: 4. Tentativas de mudança de status fora do prazo: **259**.
- Slots R1 **sem nenhum attendee**: **47** (9% dos slots R1).
- Deals com 2+ reuniões no mesmo dia: **1**.
- Registros sem autoria: 4 slots sem `booked_by`; 0 attendees sem `booked_by`.
- Ghost appointments detectados: 0.

## 6. Veredito

**Não são confiáveis hoje** como base de apuração de meta mensal do OTE. O agendamento é sólido; "realizada" e "conversão" não têm definição única, e a ponte venda↔reunião não existe no dado.

Riscos, do mais crítico ao menos:

1. **"Realizada" sem definição canônica** — 253 vs 352 (39%). Qualquer OTE calculado hoje depende de qual tela/consulta o avaliador abrir.
2. **"Venda" sem definição canônica e sem vínculo** — 46 a 262 conforme a fonte; 99% das transações Hubla do 50K sem `linked_deal_id`. Conversão de 16% a 66%.
3. **47 slots R1 sem attendee** — reunião existe no calendário e é invisível para qualquer métrica baseada em attendee (a maioria delas).
4. **Reuniões fora do sistema não mensuráveis** — sem fonte independente, subnotificação não é detectável nem quantificável.
5. **No-show com evidência em ~17% dos casos** — o denominador de "realizadas" é manipulável por quem marca, sem trilha na maior parte.
6. **259 mudanças de status fora do prazo** — status pode ser reescrito depois do fechamento do período.
7. **Stages duplicados (`crm_stages` × `local_pipeline_stages`) e deals em stages fantasma** — o predicado alternativo "stage do deal" também não fecha (6 + 2 + 16 contradições).
8. **"Qualificada" não é atributo da reunião** — é do deal, não reavaliado em reagendamento; `lead_type` nulo em 25% dos slots.

O que precisaria mudar (nada implementado agora, apenas o escopo):

- Fixar **uma** definição de R1 realizada em RPC única e fazer todas as telas consumirem só ela; reconciliar os 136 + 81 divergentes.
- Fixar **uma** definição de venda válida do 50K (produto + status + data-âncora) e persistir o vínculo transação→deal→attendee no momento do pagamento, com relatório de órfãos.
- Impedir slot R1 sem attendee e exigir attendee explícito ao marcar desfecho.
- Estender evidência de no-show a todos os papéis, ou registrar no mínimo autoria + carimbo imutável.
- Travar mudança de status após o fechamento do mês (hoje só há log de tentativa).
- Marcar "qualificada" no **attendee**, no momento do agendamento, congelando o snapshot da qualificação.
- Consolidar stages numa fonte só e migrar deals em stages fantasma.

Se este diagnóstico estiver de acordo, o passo natural é aprovar apenas a **fase 1** (definições canônicas de "realizada" e "venda" + vínculo Hubla) antes de mexer em qualquer coisa.
