

## Feature: "Sem Sucesso" para Pendentes R2

### Resumo
Adicionar opção "Sem Sucesso" no menu de 3 pontos da aba Pendentes. Ao clicar, abre um modal para registrar tentativas e observações. O lead vai para uma nova aba "Sem Sucesso" na Agenda R2, onde mantém todas as opções do menu (Agendar R2, Reembolso, Parceiro, Recorrência) para possibilitar retomada.

### Mudanças

#### 1. Novo hook: `src/hooks/useR2SemSucesso.ts`
- **Mutation `useMarkR2SemSucesso`**: Atualiza o `meeting_slot_attendees.status` para `'sem_sucesso'` e salva metadata (tentativas, observação) no campo `custom_fields` ou em `deal_activities` como registro de atividade.
- **Query `useR2SemSucessoLeads`**: Busca attendees com `status = 'sem_sucesso'` de meetings R1 com `contract_paid`. Retorna os mesmos dados do `R2PendingLead` para reaproveitar os componentes. Invalida `r2-pending-leads` e novo key `r2-sem-sucesso-leads`.
- **Query `useR2SemSucessoCount`**: Retorna contagem para badge na tab.

#### 2. Novo componente: `src/components/crm/R2SemSucessoModal.tsx`
- Modal com campos:
  - **Tentativas de contato** (input numérico)
  - **Observação** (textarea)
- Botão "Confirmar Sem Sucesso" chama `useMarkR2SemSucesso`

#### 3. Novo componente: `src/components/crm/R2SemSucessoPanel.tsx`
- Lista de leads marcados como "Sem Sucesso", layout igual ao `R2PendingLeadsPanel`
- Cada card mostra: nome, telefone, data R1, closer R1, tentativas, observação
- Menu de 3 pontos com **todas as opções**: Agendar R2, Reembolso, Reconhecer Parceiro, Reconhecer Recorrência
- Badge "Sem Sucesso" em vez de "Contrato Pago"

#### 4. Atualizar `src/components/crm/R2PendingLeadsPanel.tsx`
- Adicionar item "Sem Sucesso" no `DropdownMenuContent` (após Reconhecer Recorrência), com ícone `XCircle` vermelho
- State para `semSucessoModalOpen` e `semSucessoLead`
- Renderizar `<R2SemSucessoModal />`

#### 5. Atualizar `src/hooks/useR2PendingLeads.ts`
- No filtro (Step 6, ~linha 198), adicionar exclusão de `status === 'sem_sucesso'` para que leads marcados saiam da lista de Pendentes

#### 6. Atualizar `src/pages/crm/AgendaR2.tsx`
- Adicionar nova aba "Sem Sucesso" entre "No-Shows" e "Pré-Agendados" com badge de contagem
- Renderizar `<R2SemSucessoPanel />` no `TabsContent`

### Fluxo do Usuário
1. Na aba Pendentes → 3 pontos → "Sem Sucesso"
2. Modal abre → preenche tentativas e observação → confirma
3. Lead sai de Pendentes e aparece na aba "Sem Sucesso"
4. Na aba Sem Sucesso → 3 pontos → pode "Agendar R2" (retoma o lead) ou qualquer outra ação

