

## Plano: Permitir criar e atribuir leads "Não Encontrados" a um SDR

### Problema
Atualmente, a seleção (checkbox) e atribuição só funciona para leads `sem_dono` que já têm `localDealId`. Leads `nao_encontrado` não existem no sistema — não têm contato nem deal criado.

### Solução
Expandir a lógica de seleção para incluir `nao_encontrado`, e ao clicar "Atribuir", usar a edge function `import-spreadsheet-leads` (já existente) para criar contato + deal na Pipeline Inside Sales, já com o SDR como owner.

### Alterações

**Arquivo: `src/pages/crm/LeadsLimbo.tsx`**

1. **Expandir seleção para `nao_encontrado`**: Remover a restrição `r.status === 'sem_dono' && r.localDealId` dos métodos `toggleSelect`, `toggleSelectAll`, `selectByCount`, `selectAllFiltered` e do checkbox na tabela. Permitir selecionar rows que sejam `sem_dono` (com dealId) OU `nao_encontrado`.

2. **Atualizar `handleBulkAssign`**: Separar os selecionados em dois grupos:
   - **Com deal** (`sem_dono` + `localDealId`): usar `assignMutation` existente (atualizar owner)
   - **Sem deal** (`nao_encontrado`): usar `useCreateNotFoundDeals` do `useSpreadsheetCompare.ts` passando `{ leads, originId: INSIDE_SALES_ORIGIN_ID, ownerEmail, ownerProfileId }`

3. **Importar `useCreateNotFoundDeals`** de `useSpreadsheetCompare.ts` e `INSIDE_SALES_ORIGIN_ID` (já importado).

4. **Atualizar contadores**: O botão "Selecionar todos filtrados" deve mostrar a contagem correta (sem_dono + nao_encontrado).

5. **Feedback**: Após criação, atualizar os resultados locais mudando status de `nao_encontrado` para `com_dono`.

### Nenhuma alteração no banco de dados
A edge function `import-spreadsheet-leads` já cria contato + deal com owner. Não precisa de migração SQL.

