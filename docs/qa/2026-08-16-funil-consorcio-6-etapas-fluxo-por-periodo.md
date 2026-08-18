# Funil Consórcio — 6 etapas, fluxo por período e fila de tratamento

Data: 2026-08-16

## Contexto

O Pós-Reunião do Consórcio tinha 7 abas planas sem noção de funil, e o Controle Consórcio era uma página separada com outras 8. Esta entrega consolidou tudo numa timeline de 6 etapas com filtro de período único, e depois corrigiu três defeitos de medição que faziam o funil crescer da esquerda para a direita.

Definições ditadas pelo CEO (são a régua oficial):

| # | Etapa | Definição de negócio |
|---|---|---|
| 1 | R1 Agendadas | todas as reuniões agendadas PARA o período |
| 2 | R1 Realizadas | reuniões que o closer marcou como realizada |
| 3 | Cartas Negociadas | lead demonstrou interesse e está enviando documentação |
| 4 | Cadastros Pendentes | documentos enviados, aguardando cadastro na Embracon |
| 5 | Cadastradas | processo externo de pagamento/cadastramento na Embracon |
| 6 | Cotas | cotas contratadas no período |

## Reorganização de telas

- `/consorcio` (Controle Consórcio) **deixou de existir**. Rota substituída por redirect EXATO para `/consorcio/crm/pos-reuniao` (nunca `consorcio/*` — há 5 rotas irmãs: `bi-consorcio`, `fechamento`, `painel-equipe`, `pagamentos`, `crm`).
- Cotas, Cadastros Pendentes e Cadastradas migraram integralmente para o Pós-Reunião, com KPIs, filtros, CSV de 66 colunas, modais e o `ConsorcioConfigModal`.
- Cartas Declinadas, Contemplação, Grupos, Previsão e Indicações foram para `/consorcio/crm/consultas` (9 abas, dois grupos separados visualmente).
- `Index.tsx` da BU virou `src/components/consorcio/CotasTab.tsx`. Item "Controle Consorcio" removido da sidebar; `BU_CONFIG.consorcio.href` de `Home.tsx` repontado (corrige também o botão "Ir para minha área").
- Deep-link `?tab=` e `?periodo=&de=&ate=` em todas as telas.

## Correção 1 — R1 Realizadas: `contract_paid` fora

`useR1CloserMetrics` definia realizada como `completed | contract_paid | refunded` — regra do Incorporador aplicada ao Consórcio sem checagem. O termo "contrato pago" **não existe no vocabulário do Consórcio**, e a própria Agenda esconde esse filtro quando a BU é consórcio (`{activeBU !== 'consorcio' && <SelectItem value="contract_paid">}`).

Ainda assim havia 29 attendees com esse status no recorte por origem de Consórcio (18 no recorte por closer) — ou seja, não é vazamento do Incorporador. Decisão do CEO: **realizada = apenas `completed`**. As demais caem no balde de dívida operacional.

## Correção 2 — recorte de BU

`useBUOriginIds('consorcio')` lê `bu_origin_mapping`, cujo conteúdo real é:

| bu | tipo | entidade | grupo |
|---|---|---|---|
| consorcio | group | **BU - LEILÃO** (default) | — |
| consorcio | origin | Efeito Alavanca + Clube | BU - LEILÃO |
| consorcio | origin | Cobrança Consorcio | BU - LEILÃO |

**Viver de Aluguel não está mapeada** — vive no grupo `Perpétuo - X1`, do Incorporador. Usar esse mapeamento perderia mais da metade do volume.

Medição de R1 agendadas por eixo, mar–ago/2026:

| Eixo | Total | O que perde |
|---|---|---|
| Origem do deal (2 constantes) | 1.674 | 42 de `Cobrança Consorcio` |
| BU do closer | 1.693 | 49 atendidas por closer do Incorporador |
| União | 1.742 | — |

**Eixo adotado: BU do closer**, igual à Agenda R1 (mesma tela que a equipe usa), **incluindo closers inativos que tiveram reunião no período** — senão quem sai do time leva o histórico junto. Convergência de 96% entre os eixos.

**Pendência: `bu_origin_mapping` continua errado** e afeta `useBUFunnelComplete` / Visão Geral do CRM. Requer auditoria própria.

## Correção 3 — estoque vs fluxo (a causa da inversão)

As etapas 3, 4 e 5 contavam **estoque residual** (o que continua parado naquele status hoje) enquanto 1, 2 e 6 contavam **fluxo do período**.

Agosto/2026, medido:

| | Criados no período | Etapa mostrava | Descartados |
|---|---|---|---|
| Propostas | 26 | **1** | 25 já aceitas (96%) |
| Cadastros | 26 | **3** | 20 já viraram cota |

Novas definições:
- **Etapa 3** = todas as propostas criadas no período (`proposal_date ?? created_at`), excluindo apenas `carta_excluida`. Selo com o estoque: "1 ainda não aceita".
- **Etapa 4** = todos os cadastros criados no período (`aceite_date ?? created_at`), qualquer status. Selo: "3 aguardando abertura". Ações (Abrir/Vincular/menu) só em `aguardando_abertura`.
- Os selos são clicáveis e filtram a lista — a fila de trabalho da equipe não se perde.

Também foi trocado o divisor entre 3 e 4: antes era a derivação `!completa && !cadastro_completo` (exigia checklist campo a campo + documento), que fazia proposta aceita com checklist incompleto aparecer **nas duas etapas ao mesmo tempo**. Agora o divisor é o **aceite**, e o checklist incompleto vira selo âmbar dentro da etapa 4.

## Correção 4 — etapa 6 e o universo

Das 50 cotas de agosto:

| Recorte | Qtd |
|---|---|
| Com cadastro do funil vinculado | 22 |
| Criadas direto ("+ Adicionar Cota") | **28** |
| Sem nenhuma reunião vinculada | **30 (60%)** |

A bolinha mostra o total (50) com a composição no card — **Do funil · Externas · Total** — e a taxa de conversão usa o número do funil, não o total.

Composição das 28 externas de agosto: por vendedor Joao Pedro Martins Vieira 22 · André Duarte 4 · sem vendedor 2. Por origem declarada: `reverter` 17 · `collab_diego_oliveira` 8 · `socio` 2 · outros 1. **Não é canal invisível** — é o fluxo de reverter e um colaborador.

Conferência: clicar em "Externas" filtra a lista; colunas novas **Origem no funil** (badge "sem vínculo"), **Criada por** e **Criada em**; quebra por vendedor e origem com o filtro ativo; CSV respeita o filtro.
`consortium_cards` **não tem coluna de autoria** — "Criada por" vem do `actor_name` do primeiro evento de `consortium_card_activity_log` (cobertura 100% em agosto).

## Correção 5 — etapa 5 muda de fonte

`consorcio_pending_registrations.status = 'cadastrada'` tinha **1 linha em 388**, sem carimbo de transição, sem ator, reversível. `useMarkPendingAsCadastrada` grava só o status. Não existe coluna de "quando virou cadastrada", `updated_at` é sobrescrito por qualquer edição e `audit_logs` tem 0 linhas dessa tabela.

Também foi descartado `webhook_carta_cadastrada_enviado_em`: apesar do nome, ele dispara no **aceite pelo Closer** (webhook para o Make, evento `consorcio.carta.cadastrada`), não no cadastramento pela administradora. Preenchido em 23,7% e em 0 registros de agosto.

**Não existe nenhuma integração com a Embracon** — grupo e cota são digitados à mão no `OpenCotaModal`.

Nova fonte: `consortium_cards.data_reserva`, **restrita às cotas com origem no funil** (sem essa restrição a etapa viria com 49 em agosto e inverteria contra os 26 da etapa 4). Agosto: **19**.

### Alerta registrado

A mediana entre `data_reserva` e `data_contratacao` em agosto deu **0 dias** — 15 das 19 têm as duas datas no mesmo dia. **Hoje a etapa 5 é praticamente espelho da etapa 6.** Ela só mede o cadastramento real na Embracon se a equipe abrir a cota como reserva (`tipo_registro='reserva'`, hoje 0 linhas) e converter quando a administradora confirmar, via `useConverterReservaToContratacao`. É mudança de rotina, não de código. Registrado em comentário no hook e no componente.

## Correção 6 — taxas de conversão

As etapas 5 e 6 usam **eixos de data diferentes sobre as mesmas linhas** (`data_reserva` vs `data_contratacao`). Das 22 cotas do funil contratadas em agosto, 1 não tem reserva e 2 reservaram em julho — a taxa 6/5 dava **115,8%**, reintroduzindo a inversão.

As taxas que chegam nas etapas 5 e 6 passaram a ser calculadas **contra a etapa 4** (`rateBaseIndex: 3`), com tooltip explicando o motivo. E foi criada uma rede de segurança: **qualquer taxa acima de 100% aparece em vermelho, com ícone e tooltip** ("provável travessia de mês ou origem fora do funil"), em vez de crescer em silêncio.

## Fila de tratamento das reuniões sem desfecho

"Sem desfecho" = reunião já passada com status `invited`/`scheduled`/`rescheduled`. Não conta como realizada nem como no-show.

| Mês | Agendadas | Sem desfecho | % |
|---|---|---|---|
| 2026-03 | 321 | 2 | 0,6% |
| 2026-04 | 296 | 13 | 4,4% |
| 2026-05 | 304 | 22 | 7,2% |
| 2026-06 | 264 | 16 | 6,1% |
| 2026-07 | 333 | 20 | 6,0% |
| 2026-08 | 172 | 23 | **13,4%** |

Em agosto, **23 de 23 eram do mesmo closer** (Andre dos Santos Duarte), todas de origem Efeito Alavanca + Clube. 18 `invited`, 5 `rescheduled`. Por SDR: Ithaline 17, Cleiton 6 — proporcional ao volume, então é falta de fechamento pelo closer, não problema de agendamento.

Não havia fila: o único lugar de fechar status era o `AgendaMeetingDrawer`, um a um, navegando o calendário.

Entregue:
- selos **No-show** e **Sem desfecho** clicáveis, filtrando a lista, com `?filtro=` na URL (link compartilhável)
- ações inline na aba R1 Agendadas: **Realizada** · **No-Show** · **Voltar p/ Agendada**
- tooltip no "Realizada" avisando que ele **muda o estágio do negócio e transfere a titularidade ao closer**
- mensagem específica quando o mês está travado, em vez do erro genérico

## Motivo estruturado no no-show

Colunas novas em `meeting_slot_attendees` (migration `20260816211811_fa9f2bda…`): `outcome_reason`, `outcome_reason_note`, `outcome_set_by`, `outcome_set_at` + índice parcial. Sem backfill — histórico fica nulo, e isso é correto.

Catálogo em `src/lib/meetingOutcomeReasons.ts`, 9 códigos em 3 grupos:
- **Lead não compareceu**: `nao_atendeu`, `avisou_em_cima`, `problema_tecnico`, `pediu_remarcacao`
- **Agendamento não deveria existir**: `numero_invalido`, `lead_duplicado`, `fora_do_perfil`, `agendamento_teste`
- `outro` (exige nota ≥3 caracteres)

Motivo **obrigatório** no no-show. Componente único (`NoShowReasonPicker`) usado no funil, no `AgendaMeetingDrawer` e no `MeetingsList` — as três telas gravam o mesmo dado. Quebra por motivo aparece acima da tabela quando o filtro de no-show está ativo, incluindo "sem motivo registrado" para o histórico.

Ao mudar o desfecho para algo que não seja no-show, os quatro campos são zerados no mesmo UPDATE — senão o motivo antigo contaminaria a agregação.

A segunda família de motivos existe para medir: hoje essas reuniões inflam a taxa de no-show. Depois de medido o volume, decidir se viram desfecho separado.

## Bug corrigido de passagem

`MeetingsList.tsx` tinha "Marcar como realizada" / "Marcar como no-show" gravando com `row.meetingId` (o **slot**) via `useUpdateMeetingStatus` — não atualizava `meeting_slot_attendees.status`, não rodava `syncDealStageFromAgenda` (o negócio não mudava de estágio) e, em horário com dois leads, marcava o horário inteiro. Quem usava aquela tela achava que tinha fechado e não tinha. Corrigido para `row.attendeeId` com `useUpdateAttendeeAndSlotStatus`.

## Validação — agosto/2026

| Etapa | Antes | Depois | Taxa |
|---|---|---|---|
| 1 R1 Agendadas | 172 | 172 | — |
| 2 R1 Realizadas | 101 | 101 | 58,7% |
| 3 Cartas Negociadas | 1 | **26** | 25,7% |
| 4 Cadastros Pendentes | 3 | **26** | 100,0% |
| 5 Cadastradas | 1 | **19** | 73,1% (base etapa 4) |
| 6 Cotas | 50 | 50 (22 funil + 28 externas) | 84,6% (base etapa 4) |

Nenhuma taxa acima de 100%.

## Lead time medido (cotas jun–ago/2026)

| Trecho | n | Mediana | Média |
|---|---|---|---|
| R1 realizada → proposta | 88 | 0 d | 4,9 d |
| proposta → cadastro pendente | 91 | 0 d | 0,5 d |
| cadastro pendente → contratação | 225 | 7 d | 8,8 d |
| **ponta a ponta** | 140 | **8 d** | **14,6 d** |

**39% das cotas contratam em mês diferente do cadastro** e 32% em mês diferente da R1. Qualquer funil de mês fechado carrega esse ruído estrutural — só um funil de coorte eliminaria, ao custo de o mês nunca fechar.

## Pendências

1. **`bu_origin_mapping` errado para Consórcio** (grupo default = BU - LEILÃO; Viver de Aluguel ausente; `Cobrança Consorcio` desconhecida das constantes). Afeta a Visão Geral do CRM. Auditoria própria.
2. **Etapa 5 é espelho da 6** até a equipe adotar reserva como estado durável.
3. **221 deals (16,9%)** em R1 Realizada com origem de Consórcio sem nenhum attendee em slot não cancelado — somem de qualquer corte por `scheduled_at`.
4. **96 reuniões passadas sem desfecho** no acumulado — acionável pela operação.
5. Ordenação da tabela de SDRs ainda diverge no caminho sem filtro de pipeline (cosmético).
6. Seta de 84,6% desenhada entre as etapas 5 e 6, mas calculada contra a 4 — só o tooltip explica.
7. `useConsorcioR1Funnel` e `useConsorcioCotasReservadas` não paginam — sujeitos ao teto de 1000 linhas do PostgREST em períodos longos ("Todo Período").

## Commits

| commit | conteúdo |
|---|---|
| `4ba82cd6` | migrou aba Cotas para componente; desmontou `/consorcio` |
| `161fab0b` | funil de 6 etapas com período global; `useConsorcioR1Funnel`, `R1FunnelTab` |
| `67724bbc` | motivo estruturado + fila do sem desfecho + correção do `MeetingsList` |
| `a1b83c6f` | limpeza do motivo ao reverter desfecho; `meetingType` real; selos no mobile |
| `9173556a` | etapas 3 e 4 por fluxo; composição da etapa 6 |
| `9667ec3c` | etapa 5 via `data_reserva`; conferência das cotas externas |
| `3355c54d` | taxas contra a etapa 4; alerta de taxa >100% |

Publicado em produção em 16/08/2026.

---

## Exceção documentada (2026-08-16 → atualização Pós-Reunião)

**Etapa 3 — Cartas Negociadas:** propostas criadas apenas para marcar
"aguardando retorno" do cliente (`aguardando_retorno = true` **e**
`valor_credito = 0`) **não** contam na etapa 3 e **não** somam no card
"Crédito Contratado — Cartas Negociadas".

Motivo: essas linhas nascem sem valor/prazo (registro de follow-up, não de
carta negociada) e inflavam a etapa com R$ 0,00.

Comportamento na aba: a linha continua visível na lista, com badge âmbar
**"Aguardando retorno"** no lugar do status "Pendente", botão **Cadastrar**
desabilitado (tooltip "Registre valor e prazo antes de cadastrar") e o lápis
de edição habilitado. Ao preencher valor/prazo, a proposta volta a contar
normalmente na etapa 3 e no card.

Nenhuma outra definição de contagem do funil de 6 etapas foi alterada.
