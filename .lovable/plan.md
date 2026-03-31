

## Auditoria Completa do Fluxo CRM (Pipeline/Kanban)

Após análise detalhada de todo o fluxo principal do CRM — Visão Geral, Negócios (Kanban), Contatos, Drawer de detalhes, criação de deals, drag-and-drop — identifiquei os seguintes problemas e pontos soltos:

---

### Problema 1: Activity log usa `clint_id` em vez de UUID no `deal_id`
**Arquivos**: `DealKanbanBoard.tsx` (linha 233), `DealKanbanBoardInfinite.tsx` (linha 175)

Ao arrastar um deal entre estágios, o `createActivity.mutate()` usa `deal.clint_id || dealId` como `deal_id`. O `clint_id` é um ID externo do Clint (string numérica), mas a tabela `deal_activities` espera o UUID do deal (`deal.id`). Isso causa:
- Atividades "soltas" que não linkam ao deal correto
- Timeline e histórico incompletos para deals que têm `clint_id`

**Correção**: Usar `dealId` (que é o UUID do Supabase) diretamente, sem o fallback para `clint_id`.

---

### Problema 2: `DealHistory` e `LeadFullTimeline` também recebem `clint_id`
**Arquivo**: `DealDetailsDrawer.tsx` (linhas 204, 224)

```tsx
<LeadFullTimeline dealId={deal.clint_id} dealUuid={deal.id} ... />
<DealHistory dealId={deal.clint_id} dealUuid={deal.id} ... />
```

Esses componentes recebem `clint_id` como `dealId` primário. Se as queries internas filtram por `deal_id = clint_id`, podem não encontrar atividades que foram gravadas com UUID (ou vice-versa). A inconsistência entre os dois formatos de ID é um risco constante de dados "perdidos" no histórico.

**Correção**: Verificar se `LeadFullTimeline` e `DealHistory` usam `dealUuid` como fallback e unificar para UUID.

---

### Problema 3: Drawer do Kanban não atualiza ao mover deal
**Arquivo**: `DealKanbanBoard.tsx` (linhas 431-435)

O `DealDetailsDrawer` recebe `dealId` e `open` mas não recebe callback de `onStageChange`. Se o drawer estiver aberto e o usuário arrastar outro deal (ou o mesmo), o drawer não refaz o fetch. O badge de estágio no header ficará desatualizado.

**Correção**: Passar `key={selectedDealId}` no drawer para forçar remontagem, ou invalidar a query quando `onDragEnd` é chamado.

---

### Problema 4: Visão Geral hardcoda `PIPELINE_ORIGIN_ID`
**Arquivo**: `FunilDashboard.tsx` (linha 22)

```tsx
const PIPELINE_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';
```

O Funil Dashboard usa um ID fixo de pipeline, ignorando completamente a BU ativa. Quando acessado via `/consorcio/crm` (BU Consórcio), mostra os dados do Incorporador. Deveria usar o `useActiveBU()` e `useBUPipelineMap()` para resolver a pipeline correta.

**Correção**: Importar `useActiveBU` e `useBUPipelineMap`, resolver a pipeline padrão da BU ativa, e usar como `originId` no `useClintFunnel`.

---

### Problema 5: Contatos não filtra por BU
**Arquivo**: `Contatos.tsx`

A página de Contatos não aplica filtro de BU — mostra todos os contatos de todas as BUs. O hook `useContactsEnriched` busca contatos globalmente. Enquanto o Kanban (Negócios) filtra por `originId`, a aba de Contatos não tem essa restrição.

**Ação**: Documentar como comportamento intencional (contatos são globais) ou adicionar filtro por pipeline da BU ativa.

---

### Problema 6: Criar deal sem owner em pipelines com distribuição ativa
**Arquivo**: `DealFormDialog.tsx`

O formulário de "Novo Negócio" permite criar deals sem `owner_id`. Em pipelines com distribuição automática de leads configurada, isso cria um deal "órfão" que não entra no fluxo normal de distribuição.

**Ação**: Documentar — este é provavelmente intencional para admin/managers que criam deals manualmente.

---

### Problema 7: Tooltip do card trava em hover (duplo TooltipProvider)
**Arquivo**: `DealKanbanCard.tsx` (linhas 292-293, 370-379)

O componente usa um `TooltipProvider` + `Tooltip` envolvendo o card inteiro (para mostrar info do contato), mas também usa tooltips internos para "Outside" e outras badges. Tooltips aninhados podem causar comportamento errático — o tooltip externo pode interferir nos internos.

**Ação**: Menor prioridade — funciona na maioria dos casos mas pode causar problemas pontuais.

---

## Plano de Correções (por prioridade)

### Fase 1 — Integridade de dados (crítico)
1. **Corrigir `deal_id` no log de atividades** — Usar UUID em vez de `clint_id` em `DealKanbanBoard.tsx` e `DealKanbanBoardInfinite.tsx`
2. **Verificar e corrigir `DealHistory`/`LeadFullTimeline`** — Garantir que queries usam UUID como primário

### Fase 2 — Consistência de BU
3. **FunilDashboard usar BU ativa** — Substituir `PIPELINE_ORIGIN_ID` hardcoded por pipeline da BU ativa

### Fase 3 — UX (menor)
4. **Drawer refetch após drag** — Garantir que o drawer atualiza dados após mover um deal

### Arquivos afetados
- `src/components/crm/DealKanbanBoard.tsx` — Corrigir `deal_id` no `createActivity`
- `src/components/crm/DealKanbanBoardInfinite.tsx` — Mesma correção
- `src/components/crm/DealDetailsDrawer.tsx` — Verificar uso de `clint_id` vs UUID
- `src/components/crm/FunilDashboard.tsx` — Usar BU ativa em vez de ID hardcoded

