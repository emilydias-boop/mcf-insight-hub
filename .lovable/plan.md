

## Auditoria Completa: Fechamento Equipe (BU Incorporador)

### Percurso completo mapeado

```text
Listagem (Index.tsx)
  ├── Filtros (nome, cargo, BU)
  ├── Cards financeiros (Fixo, Variável, Total Conta, iFood)
  ├── TeamGoalsSummary (Meta, Supermeta, Ultrameta, Divina)
  ├── Tabela de payouts
  └── Recalcular Todos → Edge Function recalculate-sdr-payout
         ├── Busca KPIs (RPC para SDR, meeting_slots para Closer)
         ├── Busca/cria comp_plan (fallback por nível)
         ├── Busca métricas ativas (fechamento_metricas_mes)
         ├── Calcula variável (multiplicadores 0/0.5/0.7/1/1.5)
         ├── Calcula iFood (calendário + ultrameta time)
         ├── Calcula faturamento por BU (dedup Hubla)
         └── Registra vencedores Meta Divina

Detalhe (Detail.tsx)
  ├── Cards resumo (OTE, Fixo, Variável, Total, iFood)
  ├── KpiEditForm (edição manual de KPIs)
  ├── DynamicIndicatorsGrid (indicadores por métrica)
  ├── IntermediacoesList
  ├── Ajustes Manuais
  └── Status flow: DRAFT → APPROVED → LOCKED

Configurações (Configuracoes.tsx)
  ├── Tab SDRs (cadastro/edição)
  ├── Tab Planos OTE
  ├── Tab Métricas Ativas
  ├── Tab Dias Úteis (calendário)
  └── Tab Metas do Time

Meu Fechamento (MeuFechamento.tsx)
  ├── Visão do SDR/Closer do próprio payout
  ├── Upload NFSe
  └── SdrFechamentoView / CloserFechamentoView
```

---

### Problemas encontrados

**1. Variável zerada na listagem (screenshot do usuário mostra R$ 0,00)**
A coluna "Variável" na tabela da Index.tsx exibe `payout.valor_variavel_total`, que vem salvo no banco. O Detail.tsx recalcula em tempo real via `useCalculatedVariavel`. Quando o "Recalcular Todos" roda pela Edge Function, os KPIs de tentativas e organização estão zerados (pois são manuais) — resultando em multiplicador 0x para essas métricas e variável baixo/zerado.

**2. Duplicação de lógica de cálculo (3 implementações diferentes)**
- Edge Function `recalculate-sdr-payout` (1438 linhas)
- Hook `useSdrFechamento.ts` → `calculatePayoutValuesDynamic` (usado pelo "Recalcular Todos" do frontend)
- Hook `useCalculatedVariavel.ts` (usado pelo Detail.tsx em tempo real)

Cada uma tem divergências sutis na lógica, especialmente para Closers. A Edge Function tem 2 caminhos separados para Closers (`calculateCloserPayoutValues` nunca é chamado — é dead code) vs SDRs.

**3. `calculateCloserPayoutValues` é dead code**
A função definida na linha 114 da Edge Function nunca é invocada. O fluxo real para Closers vai direto para o cálculo inline (linhas 1063-1212). A função duplicada pode causar confusão.

**4. Campo `pct_reunioes_agendadas` abusado para Closers**
Na Edge Function (linha 1188), o campo `pct_reunioes_agendadas` armazena o % de contratos para Closers. Isso quebra a semântica e pode confundir relatórios/exports.

**5. Vendas Parceria sem multiplicador real**
Na Edge Function (linha 1152), `valorVendasParceria` é calculado como peso × base, sem multiplicador — sempre recebe 100% do valor base independente da performance. No `useCalculatedVariavel.ts`, o mesmo ocorre via `isDynamicCalc` mas com multiplicador aplicado. Divergência.

**6. No-Show para SDRs: lógica inconsistente**
Na Edge Function (linha 743): `noShows = agendamentos - realizadas` (usa agendamentos por `booked_at`).
Mas no hook `useOwnFechamento` (linha 151): usa `meeting_slot_attendees.status === 'no_show'`.
Dois cálculos diferentes para a mesma métrica.

**7. Filtro de BU no TeamGoalsSummary hardcoded**
Linha 377 de Index.tsx: `bu={squadFilter !== 'all' ? squadFilter : 'incorporador'}` — quando "Todas BUs" está selecionado, sempre mostra metas do Incorporador. Deveria ocultar ou mostrar todas.

**8. Meta Divina: critério de "melhor" divergente**
Na Edge Function (linha 1337): usa `pct_media_global` (% performance).
No `TeamGoalsSummary.tsx` (linha 108): usa `total_conta` (valor absoluto em R$).
Critérios diferentes para eleger o vencedor.

**9. "Recalcular Todos" no frontend (`useRecalculateAllPayouts`) é redundante**
O botão chama a Edge Function, mas o hook `useRecalculateAllPayouts` existe no frontend e faz a mesma coisa localmente. O botão já usa `recalculateViaEdge` (correto), mas o hook legado continua importado e exportado.

**10. Configurações: tab "SDRs" é redundante com RH**
A aba de cadastro de SDRs em Configuracoes.tsx permite criar SDRs com squad/nível, mas o sistema já usa `employees` + `cargo_catalogo` como fonte da verdade para BU e nível. Manter dois cadastros causa inconsistências.

---

### O que pode ser removido

1. **`calculateCloserPayoutValues`** (linhas 114-274 da Edge Function) — dead code, nunca chamado
2. **`useRecalculateAllPayouts`** hook no frontend — o botão já usa a Edge Function diretamente
3. **`calculatePayoutValues` legado** (linhas 608-617 de `useSdrFechamento.ts`) — wrapper desnecessário que apenas chama `calculatePayoutValuesDynamic`
4. **Aba "SDRs" nas Configurações** — pode ser simplificada, pois nome/email/squad já vêm do RH. Manter apenas para vincular `user_id` e `meta_diaria`

---

### O que pode melhorar

1. **Unificar lógica de cálculo**: Uma única função compartilhada (ou mover todo cálculo para a Edge Function e o frontend apenas exibir valores salvos)
2. **Campo dedicado para % contratos**: Em vez de abusar `pct_reunioes_agendadas` para Closers
3. **TeamGoalsSummary**: Quando filtro é "Todas BUs", mostrar um resumo consolidado ou ocultar
4. **Meta Divina**: Alinhar critério (% performance ou total R$) entre Edge Function e frontend
5. **Vendas Parceria**: Aplicar multiplicador consistente ou definir que é sempre 100%
6. **Adicionar validação**: Impedir recálculo de payouts APPROVED (atualmente só bloqueia LOCKED)

---

### Resumo de prioridades

| Prioridade | Item | Impacto |
|---|---|---|
| Alta | Variável zerada (tentativas/organização manuais) | Afeta valores na listagem |
| Alta | Divergência de critério Meta Divina | Pode premiar pessoa errada |
| Média | Dead code na Edge Function | Confusão de manutenção |
| Média | Campo `pct_reunioes_agendadas` semântica errada | Relatórios incorretos |
| Baixa | Hooks legados redundantes | Limpeza de código |
| Baixa | Duplicação de lógica de cálculo | Risco de drift futuro |

