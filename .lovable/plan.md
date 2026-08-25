# Retrato atual — Painel Comercial Consórcio, aba SDRs

Levantamento apenas (nada foi alterado). Rótulos e rotas copiados do código.

## 1) O que a seta `›` faz hoje

- Componente da linha e da seta: `src/components/sdr/ConsorcioSdrSummaryTable.tsx`
  - cabeçalhos das colunas: linhas 163-198 (`SDR`, `Meta`, `Agendamento`, `Reuniões Agendadas`, `Reuniões Realizadas`, `No-show`, `Vendas Realizadas`, `Cotas Contratadas`, `Consórcio Efetivado`, `Ticket Médio`, `Conv. Vendas / Reunião` — os três últimos rótulos vêm de `CONSORCIO_LABELS`)
  - seta: linhas 302-306 (`ChevronRight`, só renderiza quando `!disableNavigation`)
  - clique na linha: linhas 237-241
- Renderizada em `src/pages/bu-consorcio/PainelEquipe.tsx:663-683`.
- Navegação (linhas 134-137): `navigate(/crm/reunioes-equipe/{sdrEmail}?{params})` — leva os filtros de período na query.
- Rota de destino: `src/App.tsx:326` → `SdrMeetingsDetailPage`, com `RoleGuard allowedRoles={['admin','manager','coordenador','sdr','closer_sombra']}`. Observação: `closer` **não** está nessa lista (na rota do closer de consórcio, `App.tsx:239`, está).
- Desabilitada por papel: sim. `PainelEquipe.tsx:71` — `const isRestrictedRole = role === 'sdr' || role === 'closer';` e `PainelEquipe.tsx:666` — `disableNavigation={isRestrictedRole}`. Confirmado: para `sdr` e `closer` a linha não é clicável e a seta não aparece.

## 2) A tela de destino (`src/pages/crm/SdrMeetingsDetailPage.tsx`)

- Compartilhada com Incorporador: **sim**. Não é específica de Consórcio.
- Parâmetro de BU: não existe na URL. A BU vem de `useActiveBU()` (linhas 8 e 35). `src/hooks/useActiveBU.ts:14-27` usa (1) `BUContext.activeBU`, (2) fallback `useMyBU()[0]`. A rota `crm/reunioes-equipe/:sdrEmail` **não** está envolvida em `BUProvider`, então o valor efetivo é a BU do perfil de quem está logado — não a BU da tela de origem. Valor padrão portanto: BU do usuário, ou `null`.
- Conteúdo (rótulos exatos), linhas 186-189: abas `Visão Geral` e `Reuniões ({allMeetings.length})`.
  - `Visão Geral` (194-210): `SdrDetailKPICards`, `SdrProjectionCard`, `PersonalRefundsCard`.
  - `Reuniões` (218-222): `SdrLeadsTable`.
- Hooks: `useSdrPerformanceData` (98-106) e `useSdrMeetingsFromAgenda` (109-114). **Nenhum dos dois recebe `buFilter` nessa página** — compare com `PainelEquipe.tsx:196-202`, que passa `buFilter: BU_SQUAD`. Ou seja, os dados aqui não estão comprovadamente filtrados por Consórcio.
- "Voltar": `handleBack` (136-141) navega para `/crm/reunioes-equipe` — o painel genérico, não `/consorcio/painel-equipe`. Esse painel genérico é misto de BU (renderiza `IncorporadorMetricsCard`, `ReunioesEquipe.tsx:840`).

Conclusão desta parte: hoje o SDR de Consórcio cai numa tela genérica, sem BU garantida, e o Voltar o tira do contexto de Consórcio.

## 3) Molde do closer — `src/pages/bu-consorcio/CloserDetalheConsorcio.tsx`

Abas na ordem (linhas 457-464), com hook de cada uma:

| # | Rótulo | Hook / fonte |
|---|---|---|
| 1 | `Agendadas ({n})` | `useConsorcioCloserReunioes` → `.agendadas` (linha 356), tabela `ReunioesTable` |
| 2 | `Reuniões Realizadas ({n})` | mesmo hook → `.realizadas` |
| 3 | `No-Shows ({n})` | mesmo hook → `.noShows` |
| 4 | `Vendas Realizadas ({cotas?.vendas ?? 0})` | `useConsorcioCloserCotas` (357), tabela `CotasTable` |
| 5 | `Faturamento` | `useConsorcioProducaoGerada` (358), `FaturamentoTab` |

Os dois primeiros hooks estão em `src/hooks/useConsorcioCloserDetalhe.ts` e são documentados (linhas 8-19) como lendo **as mesmas fontes do Painel Comercial**: RPC `get_agenda_fatos_consorcio` filtrada por `closer_id`, e `consortium_cards` com `tipo_registro='contratacao'` casado por `nameKey`.

## 4) De onde viria cada aba do SDR

A tabela de SDRs é alimentada por `fatos.bySdr` (`useConsorcioAgendaDerived` sobre `useConsorcioAgendaFatos`, `PainelEquipe.tsx:214-235`), que chama a RPC `get_agenda_fatos_consorcio`.

| Coluna | Número vem de | Lista por lead já existe? |
|---|---|---|
| Agendamento | `fato==='agendamento'` (`useConsorcioAgendaFatos.ts:43`) | Sim, as linhas cruas da RPC (`ConsorcioFatoRow`, 14-24): `deal_id`, `meeting_day`, `attendee_status`, `sdr_email/name`, `closer_id/name`, `origin_name`. **Falta** nome do lead, telefone e crédito |
| Reuniões Agendadas | `fato==='agendada'` (:44) | idem |
| Reuniões Realizadas | `fato==='realizada'` (:45) | idem |
| No-show | `fato==='no_show'` (:46) | idem |
| Vendas Realizadas | `cotasContratadas.clientesBySdr` (`PainelEquipe.tsx:317,671-672`) | **Não** — só `Map<email, número>` |
| Cotas Contratadas | `cotasContratadas.bySdr` | **Não** — só `Map<email, número>` |

O que faltaria:
- Para as 4 colunas de agenda: juntar nome/telefone do lead a partir de `deal_id` (o closer faz isso com um lookup de `crm_deals.name`, `useConsorcioCloserDetalhe.ts:70-88`); telefone ainda não é buscado em lugar nenhum desse caminho.
- Para Vendas Realizadas e Cotas Contratadas: `useConsorcioCotasContratadas` só itemiza os buckets de resíduo (`semVinculoItems`, `cadastroSemLeadItems`, `foraFunilItems`, `semCloserItems`, tipo `CotaResiduoItem`, linhas 23-61). Não existe lista itemizada por SDR no caminho normal — seria o equivalente de `useConsorcioCloserCotas`, mas agrupado por SDR.
- `useSdrMetricsFromAgenda` / RPC `get_sdr_metrics_from_agenda_consorcio` existe e é consciente de Consórcio, mas **não** é a fonte desta tabela (a fonte única é `useConsorcioAgendaFatos`, comentário nas linhas 50-56). Usar essa RPC como base da tela de detalhe reintroduziria divergência com o painel.
- `useTeamMeetingsData` (chamado em `PainelEquipe.tsx:188-193`) tem `allMeetings` com `contact_name`, `contact_email`, `contact_phone`, `origin_name`, `closer`, `status_atual` — hoje usado só na aba "Leads Detalhados" do Excel (`PainelEquipe.tsx:520-533`). É um caminho paralelo; não há garantia de bater 1:1 com os números da tabela.

## 5) A regra de atribuição

Confirmada no código. Rodapé em `ConsorcioSdrSummaryTable.tsx:451-455`; implementação em `src/hooks/useConsorcioCotasContratadas.ts`:
- Venda = pessoa: `clienteKey()` linhas 166-176 (CPF/CNPJ primeiro, `doc:`; fallback nome normalizado, `nome:`).
- Cota = carta: cada linha de `consortium_cards` com `tipo_registro='contratacao'` conta 1 (linhas 212-219; âncora de data `data_contratacao`, docstring 178-193).
- SDR = **último** agendamento de consórcio do cliente: linhas 374-389, ordenação ascendente por `booked_at`/`created_at` e `dealBooker.set` sobrescrevendo, então o último vence.

Explicitamente: a aba "Vendas Realizadas" seria uma lista **por cliente** (uma linha por pessoa, podendo agregar N cotas); "Cotas Contratadas" seria **por cota** (uma linha por carta). São granularidades diferentes e a soma de cotas de uma aba não é a contagem da outra.

## 6) As duas linhas especiais

- `"Ygor Fereira — sem atividade no período"`: `ConsorcioSdrSummaryTable.tsx:312-342`, a partir de `extraSdrs` (linhas 75-78) = SDRs presentes em `cotasBySdr` (têm cota atribuída no período) mas ausentes dos fatos de agenda do período (`emailsNaTabela`, :74). Representa SDR com venda creditada cujo agendamento caiu fora da janela filtrada — injetada para o total fechar com o card de KPI.
- `"Sem agendamento de consórcio"` (itálico, com lupa): linhas 345-373, exibida quando `cotasSemVinculo > 0`, valor de `cotasContratadas.semVinculo` (`PainelEquipe.tsx:675`). Clique abre `ResiduoDetalheModal` com `semVinculoItems`. Representa cotas de clientes que **não têm nenhum** agendamento de consórcio em nenhuma das suas cotas — logo não há SDR a quem creditar. Distinta da linha `"Não atribuído"` (375-399, de `fatos.sdrUnassigned`), que é fato de agenda com reunião mas sem agendador identificável.

## Aberto / não determinei

- Se `useSdrPerformanceData` filtra BU internamente (só a assinatura foi lida, `src/hooks/useSdrPerformanceData.ts:134`).
- Valor de runtime de `useActiveBU()` para um usuário de Consórcio nessa rota — depende do perfil, não verificável estaticamente.
