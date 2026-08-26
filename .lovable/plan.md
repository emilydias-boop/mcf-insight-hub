# Diagnóstico somente leitura — Naufel R$ 720.000 em "Produção sem atribuição"

Nenhuma escrita proposta nesta rodada; apenas o mapa do caminho normal da tela.

## 1) O que precisa mudar para o número sair do balde

**Resposta em uma frase: é obrigatório mudar o `deal_id` da PROPOSTA (`consorcio_proposals`); mudar só o `deal_id` dos 6 cadastros não move um centavo.**

Prova:
- Perna A lê a proposta: `src/hooks/useConsorcioProducaoGerada.ts:290-293` — `.from("consorcio_proposals").select("id, deal_id, created_by, ...")`.
- A atribuição usa **somente** `p.deal_id` da proposta: linhas 389-390 (`dealParaCloser.get(p.deal_id)` e `dealParaCloserReuniao.get(p.deal_id)`), caindo em `SEM_ATRIBUICAO` na linha 391.
- Os 6 cadastros nem entram na perna B: linha 514-515 — `regsAvulsos = regs.filter(r => { if (r.proposal_id) return false; ... })` (caminho 4). Como todos têm `proposal_id` preenchido, são excluídos da perna B independentemente do `deal_id` deles.

Com `deal_id = 9f74d159…` na proposta: elo 1 (created_by Antony, não é closer) falha → elo 2 pega `owner_id` = andre.duarte → closer André Duarte (linhas 342-347). O SDR (Cleiton) vem do `booked_by` da reunião de 24/08 no lead `9f74d159`, pela lógica de agenda já existente — não por este hook.

## 2) Tela que troca o lead de uma PROPOSTA

**Não existe.** Varredura em todo o `src/`: nenhum `.update()` em `consorcio_proposals` fora de tipos; `EditProposalModal.tsx` e `CartasProposalEditor.tsx` não têm campo `deal_id` (busca por `deal_id|dealId` retornou 0 ocorrências nos dois arquivos). O único fluxo de "Trocar lead" é o de **cota contratada** (`ResiduoDetalheModal.tsx:321,339` → `CorrigirVinculoCotaModal`), que opera sobre `consortium_cards`, não sobre propostas.

## 3) A RPC `consorcio_corrigir_vinculo_cota` mexe em proposta?

Corpo lido via `pg_proc`. Ela escreve em exatamente duas tabelas:
- `consorcio_pending_registrations` — UPDATE de `deal_id` (linhas 80-82 e 93-95 do corpo) ou INSERT de cadastro novo (linhas 99-115);
- `audit_logs` — INSERT de auditoria `cota_vinculo_impacto` (linhas 120-137).

**Não toca em `consorcio_proposals`.** E é inaplicável aqui: o primeiro passo é `SELECT * FROM consortium_cards WHERE id = p_card_id` com exceção "Cota não encontrada" se não existir (linhas 27-30). Os 6 cadastros do Naufel estão em `aguardando_abertura` **sem** `consortium_card_id` (caminho 3 falso na checagem anterior) — não há `p_card_id` válido para chamá-la.

## 4) Os 6 cadastros aparecem em algum alerta da tela?

**Confirmado: não aparecem em nenhum alerta com botão de correção.**
- `useConsorcioCotasContratadas.ts:250-254` lê apenas `consortium_cards` com `tipo_registro='contratacao'` — sem card, sem linha no alerta.
- `CadastroSemLeadAlerta.tsx` e `ResiduoDetalheModal.tsx` (botão "Trocar lead") consomem somente itens dessa fonte (`CotaResiduoItem`).
- Os cadastros aparecem apenas como linhas operacionais na lista de cadastros pendentes (`PendingRegistrationsList.tsx`, páginas Pós-Reunião e Consultas), que **não** tem ação de trocar lead (busca por `deal` no arquivo: 0 ocorrências de edição de vínculo).

## 5) Campo Vendedor

**Confirmado:** quando contratadas, as 6 cotas caem em "Sem vendedor identificado". Perna B/cotas atribuem por `nomeParaCloser.get(nameKey(vendedor_name_cota || vendedor_name))` (`useConsorcioProducaoGerada.ts:531` e `:657`); "Diego Carielo" não casa com nenhum closer da BU → `SEM_ATRIBUICAO`, exibido como "Sem vendedor identificado" (`ConsorcioCloserSummaryTable.tsx:356,519`). O próprio formulário avisa isso (`ConsorcioCardForm.tsx:357-377`).

**Existe tela para editar o Vendedor do cadastro:** `OpenCotaModal.tsx` (campo Vendedor, linhas 1332-1351; grava `vendedor_id` + `vendedor_name_cota` via `useUpdatePendingRegistration`, allow-list em `useConsorcioPendingRegistrations.ts:931+` inclui `vendedor_id` e `vendedor_name_cota`). Caminho: CRM → Pós-Reunião (`/crm/pos-reuniao`) ou Consultas → lista de cadastros pendentes → abrir cadastro → Editar → campo Vendedor. Observação: as opções vêm de `consorcio_vendedor_options`; para cair no André, a opção precisa existir com nome casando (`nameKey`) com o closer — hoje existe a opção "Andre dos Santos Duarte" (o 1 cadastro dele já a usa).

## 6) Conserto pelo fluxo normal — sequência de cliques HOJE

1. Admin abre `/crm/pos-reuniao` → aba Cadastros → localiza os 6 cadastros do Naufel.
2. Para trocar o lead do cadastro: **não existe tela para este passo** (a RPC da cota exige card; a lista de cadastros não edita `deal_id`).
3. Para trocar o lead da proposta `89a6f11b…` (o que efetivamente move os R$ 720.000 no painel): **não existe tela para este passo** — nenhum componente, hook, RPC ou edge function faz update em `consorcio_proposals.deal_id`.
4. Editar o Vendedor de cada cadastro para "Andre dos Santos Duarte": existe tela (passo do item 5 acima), mas isso só afeta a perna B/cotas contratadas futuras — **não** tira os R$ 720.000 da perna A do balde.

**Conclusão, com todas as letras: para mover a PRODUÇÃO GERADA de agosto (perna A) para o André Duarte, só dá para consertar por escrita direta no banco (migration/SQL) — `UPDATE consorcio_proposals SET deal_id='9f74d159-…' WHERE id='89a6f11b-…'` — mais, por higiene, o mesmo `deal_id` nos 6 cadastros e o Vendedor corrigido. Nenhuma dessas três escritas tem caminho 100% pela interface hoje; a de vendedor tem.**

## Detalhes técnicos

- Hook central: `src/hooks/useConsorcioProducaoGerada.ts` (perna A linhas 289-411; dedup perna B linhas 514-519).
- RPC: `consorcio_corrigir_vinculo_cota` (SECURITY DEFINER; escreve `consorcio_pending_registrations` + `audit_logs`; exige card existente).
- Trava de mês fechado na RPC (linhas 36-41): se agosto/2026 estiver em `meeting_status_locks` ativo, a RPC recusaria — não verificado nesta rodada, e irrelevante por ela ser inaplicável.
- Qualquer escrita futura exige aprovação explícita do dono e será feita via ferramenta de migration com auditoria.
