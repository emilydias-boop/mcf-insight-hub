# Diagnóstico: tela de detalhe do closer no Painel Comercial (Consórcio)

Rodada de investigação. Nada de código, nada de dado tocado. Tudo abaixo saiu do arquivo/linha citado ou de consulta de leitura ao banco.

## A. O que a tela é hoje, e por que os seis cards estão vazios

- Rota: `src/App.tsx:237` — `consorcio/painel-equipe/closer/:closerId` renderiza `CloserMeetingsDetailPage` dentro de `BUProvider bu="consorcio"`.
- Componente: `src/pages/crm/CloserMeetingsDetailPage.tsx`. É **o mesmo componente** usado pela rota do Incorporador (`src/App.tsx:325`, `crm/reunioes-equipe/closer/:closerId`).
- Hook principal: `useCloserPerformanceData` (`src/pages/crm/CloserMeetingsDetailPage.tsx:99`) → `useCloserDetailData` → `useR1CloserMetrics`.

**Causa raiz dos cards vazios (não é "provavelmente"):**

`src/hooks/useCloserDetailData.ts:84` chama `useR1CloserMetrics(startDate, endDate)` **sem o parâmetro de BU**. A assinatura tem default `bu: string = 'incorporador'` (`src/hooks/useR1CloserMetrics.ts:98`), e a query filtra `closers` por `.eq('bu', bu)`.

Dado confirmado: o closer `4e3eabf5-…71f6` é **João Pedro Martins Vieira, `bu = consorcio`, ativo**. Ele não existe na lista de closers `incorporador`, então:

1. `allClosers` volta sem ele → `closerMetrics` = `null`;
2. `useCloserPerformanceData` faz `if (!cm) return []` (`src/hooks/useCloserPerformanceData.ts:116`) → `metrics = []`;
3. `SdrDetailKPICards` trata `metrics.length === 0` como **estado de carregando** e renderiza 6 `Card` com `CardContent p-4 h-[140px]` vazio (`src/components/sdr/SdrDetailKPICards.tsx:166-176`).

Os retângulos pretos são o **skeleton eterno**, não erro de render. Não há exceção: a query nem falha, ela simplesmente não encontra a pessoa. Nenhum erro no console é esperado — é o pior tipo de falha, silenciosa.

Observação adicional: o header e as listas funcionam porque vêm de outras queries — `closer-info` busca por `id` sem filtro de BU (`useCloserDetailData.ts:88-100`) e as listas de leads consultam `meeting_slots` por `closer_id` direto (`useCloserDetailData.ts:118-155`).

## B. Por que `REALIZADO` dá 0

`SdrProjectionCard` recebe `perfData.projection`, cujo `realized` é `cm?.contrato_pago || 0` (`src/hooks/useCloserPerformanceData.ts:186`). Com `cm = null`, tudo é 0 — inclusive a meta, que usa `metas.contratoPago` (4 contratos/dia útil, constante `CLOSER_META_DIARIA_CONTRATOS` em `useCloserPerformanceData.ts:57`, regra do Incorporador).

**Sim, são duas fontes de verdade diferentes para a mesma pessoa:**

| | Painel Comercial Consórcio | Tela de detalhe |
|---|---|---|
| Agenda | RPC `get_agenda_fatos_consorcio` via `useConsorcioAgendaFatos` (`PainelEquipe.tsx:337-343`) | `useR1CloserMetrics` com BU errada + queries diretas em `meeting_slots` |
| Venda fechada | `useConsorcioCotasContratadas` (cotas/clientes distintos) — `PainelEquipe.tsx:318` | `contrato_pago` de attendee (conceito do Incorporador) |
| Produção Gerada | `useConsorcioProducaoGerada` — `PainelEquipe.tsx:322` | não existe na tela |

Mesmo se a BU fosse corrigida, `contrato_pago` do Consórcio é 6 (attendees), não as 18 vendas — o Consórcio não usa "Contrato Pago" como venda fechada.

## C. O botão voltar

`handleBack` (`CloserMeetingsDetailPage.tsx:109-114`) navega para **rota fixa** `/crm/reunioes-equipe?...`. Não é `navigate(-1)` nem histórico: é hard-code do painel do Incorporador. Quem entrou por `/consorcio/painel-equipe` é jogado para outro painel, de outra BU.

## D. O que já existe para reaproveitar

- `src/components/closer/CloserLeadsTable.tsx` — tabela de leads já usada nas três abas atuais; serve para as três listas pedidas.
- `src/pages/closer/MeuDesempenhoCloser.tsx` (rota `closer/meu-desempenho`, `App.tsx:321`) — **já é a tela de auto-auditoria do closer com tratamento de Consórcio**: usa `CloserConsorcioDetailKPICards`, `useConsorcioPipelineMetricsByCloser`, `useConsorcioProdutosFechadosByCloser`, `useCloserAgendaMetrics`. É o melhor molde: os cards de Consórcio já existem e não estão vazios.
- `ConsorcioCloserSummaryTable` já emite `onCloserClick` com o `closer_id` (`components/sdr/ConsorcioCloserSummaryTable.tsx:264`) — o caminho de entrada está pronto.

Conclusão: não há o que construir de zero. O conserto é **rotear a tela de detalhe do Consórcio para os hooks de Consórcio** e reusar `CloserLeadsTable` + os cards de Consórcio.

## E. As três listas e a conferência dos números (agosto/2026, João Pedro)

Números da RPC do painel, por `closer_id`:

| fato | painel |
|---|---|
| agendada | 145 |
| realizada | **101** |
| no_show | **26** |
| fechada_agenda (contract_paid) | 6 |

Queries diretas na base da tela de detalhe (`meeting_slots.closer_id`, `meeting_type='r1'`, `scheduled_at` em agosto BRT): `completed = 101`, `contract_paid = 6`, `no_show = 26`, total 145.

- **Reuniões Realizadas:** bate (101), **desde que "realizada" = `status = 'completed'`**, como a RPC faz (`get_agenda_fatos_consorcio`, ramo `realizada`). A aba atual mostra **107** porque soma `completed` + `contract_paid` (`useCloserDetailData.ts`, filtro das listas). **Delta = 6**, exatamente os `contract_paid`. É diferença de definição, não de dado.
- **No-Show:** bate exatamente, 26. A RPC exclui `cancelled` e `is_partner = true` e deduplica (1 por deal+dia, cap 2 por deal); em agosto isso não removeu nada de JP.
- **Vendas Realizadas:** **não bate.** O painel usa `useConsorcioCotasContratadas` = clientes distintos de `consortium_cards` com `data_contratacao` no mês, casando `vendedor_name` com `closers` da BU. Medido agora: `vendedor_name = 'Joao Pedro Martins Vieira'` (sem acento) em agosto → **44 cotas, 17 clientes distintos, R$ 7.750.000 de crédito**. A linha dele no painel diz 18. **Delta = 1 cliente**, provavelmente uma cota cujo titular difere por grafia ou uma cota sem `data_contratacao` capturada por outro caminho do hook. Isso precisa ser fechado antes de a lista ser publicada — uma lista que soma 17 embaixo de um card que diz 18 é pior que nenhuma lista.

## F. Faturamento

Hoje `CloserRevenueTab` (`src/components/closer/CloserRevenueTab.tsx:39`) chama `useTransactionsByBU('incorporador', filters)` — **BU cravada no código**. Para um closer de Consórcio ela cruza transações do Incorporador com attendees com `contract_paid_at`: fora do processo, resultado sem sentido.

Os dois hooks certos devolvem mapa por closer, prontos para consumo sem recálculo:
- `useConsorcioProducaoGerada` → `byCloser: Map<closerId, ProducaoGeradaLinha>` com `credito`, `cartas`, `vendas`, antedatação e retroativos (`hooks/useConsorcioProducaoGerada.ts:48-100`).
- `useConsorcioCotasContratadas` → `byCloser`, `creditoByCloser`, `clientesCloser` (`hooks/useConsorcioCotasContratadas.ts:52-60`).

Ambos são agregadores de período: chamar com o mesmo intervalo do painel e ler a chave do closer devolve **exatamente** o número da linha dele. Nenhum recálculo.

## G. A mesma tela para SDR

- **Não existe** `/consorcio/painel-equipe/sdr/:id`. O único `onCloserClick` do painel de Consórcio é o do closer (`PainelEquipe.tsx:706`); a aba de SDRs não navega para lugar nenhum.
- Existe `crm/reunioes-equipe/:sdrEmail` → `SdrMeetingsDetailPage` (`App.tsx:324`), por **e-mail**, não id, e alimentada por `useSdrPerformanceData`, que não tem parâmetro de BU nenhum (nem default) — ou seja, mistura reuniões de todas as BUs. O `handleBack` dela também é fixo em `/crm/reunioes-equipe` (`SdrMeetingsDetailPage.tsx:136-140`).
- São **dois componentes distintos**, com o mesmo vício: rota de volta cravada e escopo de BU implícito.

## H. Permissão (só o que é)

- Rota: `RoleGuard allowedRoles={['admin','manager','coordenador','closer']}` (`App.tsx:237`).
- Dentro da página há gate próprio: quem não é admin/manager/coordenador só passa se o `closers.id` casado pelo e-mail dele for igual ao `:closerId` (`CloserMeetingsDetailPage.tsx:34-48`). **Um closer comum não abre a página do colega** — vê "Você só pode visualizar seu próprio Painel Comercial."
- Banco (RLS, leitura): `closers` → SELECT para qualquer `auth.uid() IS NOT NULL`; `meeting_slots` → idem; `meeting_slot_attendees` → SELECT exige `can_access_consorcio_pii(auth.uid())` ou papel `marketing`/`rh`. Ou seja, o bloqueio por colega é **só de UI**; no banco um closer autenticado com acesso PII leria os dados de qualquer um.

## Decisões que preciso de você antes de propor conserto

1. **"Reuniões Realizadas" na tela passa a ser 101 (só `completed`, igual ao painel) ou 107?** Minha recomendação: 101, e uma quarta lista/linha separada para os 6 `contract_paid`, para não perder registro.
2. **O delta de 1 venda (17 medidos vs 18 no painel)** — quer que eu investigue e feche esse número nesta próxima rodada, antes de qualquer UI?
3. **Escopo do conserto:** só o closer de Consórcio agora, ou closer + SDR (incluindo criar a rota de SDR do Consórcio, que não existe) no mesmo pacote?
