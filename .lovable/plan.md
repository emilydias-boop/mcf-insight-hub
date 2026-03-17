

## Adicionar "Duplicar p/ Inside Sales" na página de Contatos

### Contexto

A página de Contatos já tem seleção em massa e um `BulkActionsBar` com botão "Transferir para..." (que abre o `SendToPipelineModal`). O hook `useDuplicateToInsideSales` já existe em `useLimboLeads.ts` e faz toda a lógica de criar deal na Inside Sales vinculado ao contato.

### O que será feito

1. **Atualizar `BulkActionsBar`** para aceitar um segundo botão "Duplicar p/ Inside" (prop `onDuplicate` opcional + `isDuplicating`)

2. **Atualizar `Contatos.tsx`**:
   - Importar `useDuplicateToInsideSales` do hook existente
   - Adicionar estado para um mini-dialog de seleção de SDR/estágio (reutilizando o padrão do Limbo)
   - Ao clicar "Duplicar p/ Inside", montar os leads a partir dos contatos selecionados (`selectedIds` → buscar nome/email/phone do `filteredContacts`) e chamar a mutation com o SDR escolhido
   - Usar o estágio "Novo Lead" como default

3. **Criar `DuplicateToInsideDialog`** (componente simples):
   - Select de SDR (busca `profiles` com role SDR/Closer)
   - Select de estágio (busca `crm_stages` da origin Inside Sales)
   - Botão confirmar → chama `useDuplicateToInsideSales` com os contatos selecionados

### Arquivos a editar

| Arquivo | Ação |
|---|---|
| `src/components/crm/BulkActionsBar.tsx` | Adicionar prop `onDuplicate` e botão "Duplicar p/ Inside" |
| `src/components/crm/DuplicateToInsideDialog.tsx` | Criar dialog com select de SDR + estágio + confirmar |
| `src/pages/crm/Contatos.tsx` | Integrar dialog + mutation, mapear contatos selecionados para o formato do hook |

