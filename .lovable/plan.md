# Filtro de Segmento na tabela "Metas da Equipe"

## O que alimenta essa tabela hoje

A tabela MÉTRICA / DIA / SEMANA / MÊS é o componente `src/components/sdr/GoalsMatrixTable.tsx`, renderizado dentro de `src/components/sdr/TeamGoalsPanel.tsx`. Ela é puramente apresentacional: recebe `dayValues` / `weekValues` / `monthValues` (realizado) e as metas (`useSdrTeamTargets` + `useSdrWeekdayTargets`).

Os valores realizados são montados em `src/pages/crm/ReunioesEquipe.tsx` (linhas ~685-716), a partir de 3 blocos de hooks — um por janela (dia, semana, mês):

| Linha da tabela | Fonte | Tem `deal_id`? |
| --- | --- | --- |
| Agendamento, R1 Agendada, R1 Realizada, No-Show, Contrato Pago | `useTeamMeetingsData` → RPC `get_sdr_metrics_from_agenda` (agregada por SDR) | Não. A RPC devolve só contagens por e-mail de SDR |
| Contrato Pago (coluna Mês) | `contractsFromClosers` (`useR1CloserMetrics`) | Sim — já é segment-aware (feito no turno anterior) |
| R2 Agendada, R2 Realizada | `useR2MeetingSlotsKPIs` (query direta em `meeting_slot_attendees`) | A tabela tem `deal_id`, mas o select atual não o traz |
| Vendas Realizadas | `useR2VendasKPIs` (query direta em `deal_activities`) | A tabela tem `deal_id`, mas o select atual não o traz |

Conclusão: **não é 100% SQL agregado**. Só as 4 primeiras linhas (Agendamento / R1 Agendada / R1 Realizada / No-Show) vêm de uma RPC agregada sem `deal_id`. Todo o resto é query client-side e pode ser filtrado por `icp_segment` sem mexer no banco.

Vale notar que `useTeamMeetingsData` também retorna `allMeetingsRaw` (via `useSdrMeetingsFromAgenda`), e essas linhas **têm `deal_id`** — é exatamente o que já usamos para filtrar a tabela por SDR. Isso abre um caminho sem migração.

## Abordagem proposta (sem mexer no banco)

1. **R2 Agendada / R2 Realizada** — incluir `deal_id` no select de `useR2MeetingSlotsKPIs`, aceitar um parâmetro `segment` e filtrar os attendees pelos deals cujo `icp_segment` casa (lote via `useDealsIcpSegments`).
2. **Vendas Realizadas** — mesmo padrão em `useR2VendasKPIs`: incluir `deal_id` no select e filtrar por segmento.
3. **Contrato Pago** — coluna Mês já vem de `useR1CloserMetrics` com segmento; para Dia e Semana, passar `segment` aos hooks `useR1CloserMetrics` das respectivas janelas (ou reaproveitar o mesmo caminho já usado no card) em vez do valor da RPC, para manter coerência.
4. **Agendamento / R1 Agendada / R1 Realizada / No-Show** — derivar os 4 números a partir do `allMeetingsRaw` de cada janela (dia/semana/mês), aplicando as mesmas regras já usadas na página (dedup por deal+dia, cap de no-show por lead, recorte de SDRs válidas do squad) **apenas quando o filtro for Lead A/Lead B**. Com "Todos", os valores continuam vindo da RPC exatamente como hoje — zero mudança de número.
5. Passar `segment` de `ReunioesEquipe.tsx` para `TeamGoalsPanel` (prop opcional) só para exibir um rótulo discreto de qual segmento está aplicado; as metas configuradas continuam as mesmas (não existem metas por segmento).

## Alternativa (mais fiel, exige migração)

Adicionar um parâmetro `segment_filter text default null` na RPC `get_sdr_metrics_from_agenda` (join com `crm_deals.icp_segment`). Vantagem: os 4 primeiros números continuam calculados pela mesma lógica canônica do SQL, sem risco de divergência com o cálculo client-side. Desvantagem: mexe numa função crítica usada por várias telas (Painel Comercial, Minhas Reuniões, TV) — faria com assinatura nova e `default null` para não afetar nenhum chamador atual.

## Recomendação

Fazer a alternativa com migração para as 4 linhas da RPC (parâmetro opcional, comportamento idêntico quando null) e o filtro client-side para R2/Vendas. Isso evita reimplementar em TypeScript as regras de dedup/cap que já vivem no SQL — que é justamente onde divergências de número costumam aparecer nessa tela.

## Garantia de não-regressão

Com "Segmento: Todos" (padrão) nenhum parâmetro novo é enviado e nenhum filtro é aplicado: todos os números da tabela ficam byte-a-byte iguais aos de hoje.
