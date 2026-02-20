

# Completar Rastreabilidade do Patrimonio

## Diagnostico - O que ja existe

A estrutura de banco de dados e a logica de negocios ja estao implementadas:

- **Tabelas**: `assets`, `asset_assignments`, `asset_assignment_items`, `asset_history`, `asset_terms` -- todas existem
- **Liberacao**: Dialog completo com checklist, observacoes, geracao de termo
- **Devolucao**: Dialog com conferencia de itens e escolha de novo status
- **Manutencao e Baixa**: Dialogs funcionais
- **Termo de Responsabilidade**: Geracao automatica e aceite digital em "Meus Equipamentos"
- **Timeline**: Componente funcional mas com descricoes genericas
- **Transfer mutation**: Existe no hook (`transferAsset`) mas sem interface

## O que falta implementar

### 1. Dialog de Transferencia de Responsavel

**Novo arquivo**: `src/components/patrimonio/AssetTransferDialog.tsx`

- Aparece quando equipamento esta "Em Uso" (botao "Transferir" ao lado de "Devolver")
- Campos: Novo colaborador (combobox), data, checklist de itens, observacoes
- Ao confirmar: finaliza assignment atual como "transferido", cria novo assignment, registra historico, gera novo termo

**Modificar**: `src/pages/patrimonio/AssetDetailsPage.tsx`
- Adicionar estado `transferOpen` e botao "Transferir" (icone `ArrowRightLeft`)
- Condicao: `canTransfer = asset.status === 'em_uso' && asset.current_assignment`
- Renderizar o `AssetTransferDialog`

### 2. Timeline Enriquecida com Nomes

**Modificar**: `src/hooks/useAssetHistory.ts`
- Alterar query para incluir `created_by` com join no `profiles(full_name, email)`
- Retornar nome do usuario que executou cada acao

**Modificar**: `src/components/patrimonio/AssetTimeline.tsx`
- Exibir "por [Nome do Usuario]" ao lado da data em cada evento
- Mostrar descricao completa (ja inclui observacoes desde a ultima alteracao)

**Modificar**: `src/types/patrimonio.ts`
- Estender `AssetHistory` para incluir campo opcional `profile` com `full_name`

### 3. Card de Historico de Responsaveis na Sidebar

**Novo arquivo**: `src/components/patrimonio/AssetAssignmentHistory.tsx`

- Lista todos os assignments anteriores (status `devolvido` ou `transferido`)
- Mostra: nome do colaborador, setor, periodo (de/ate), motivo da saida
- Posicionado abaixo do card "Responsavel Atual" na sidebar

**Modificar**: `src/pages/patrimonio/AssetDetailsPage.tsx`
- Importar `useAssetAssignments` para buscar historico de assignments
- Renderizar `AssetAssignmentHistory` na sidebar

### 4. Observacoes na Devolucao

**Modificar**: `src/components/patrimonio/AssetReturnDialog.tsx`
- Adicionar campo `Textarea` para observacoes gerais da devolucao
- Passar observacoes para a descricao do historico em `asset_history`

**Modificar**: `src/hooks/useAssetAssignments.ts`
- Atualizar mutation `returnAsset` para aceitar e registrar observacoes no historico

## Resumo das alteracoes

| Arquivo | Acao |
|---------|------|
| `AssetTransferDialog.tsx` | Criar (novo dialog de transferencia) |
| `AssetAssignmentHistory.tsx` | Criar (card historico de responsaveis) |
| `AssetDetailsPage.tsx` | Editar (botao transferir + card historico) |
| `AssetTimeline.tsx` | Editar (exibir nome do autor) |
| `useAssetHistory.ts` | Editar (join com profiles) |
| `AssetReturnDialog.tsx` | Editar (campo observacoes) |
| `useAssetAssignments.ts` | Editar (observacoes na devolucao) |
| `patrimonio.ts` (types) | Editar (profile no AssetHistory) |

Nenhuma alteracao de banco de dados e necessaria -- todas as tabelas e colunas ja existem.

