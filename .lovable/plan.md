

# Central de Patrimonio - Completar Funcionalidades Faltantes

## Status Atual

O modulo ja possui a base solida: tabelas no banco, types, hooks com mutations e as paginas de listagem e detalhes. Porem, os botoes de acao na pagina de detalhes nao estao conectados a nenhum dialog/funcionalidade. Falta tambem a visao do colaborador e os relatorios.

## O que falta implementar

### 1. Dialog de Liberacao (Assign) - AssetAssignDialog.tsx
Ao clicar "Liberar" na pagina de detalhes:
- Abrir dialog com:
  - Combobox para selecionar colaborador (usando EmployeeSearchCombobox existente)
  - Date picker para data de liberacao
  - Date picker opcional para data prevista de devolucao
  - Checklist de itens (Mouse, Carregador, Headset, Teclado, Mochila, Outro)
  - Campo "outros" editavel
- Ao confirmar:
  - Chama `assignAsset` mutation (ja existe)
  - Gera termo automaticamente via `generateTermContent` (ja existe)
  - Chama `createTerm` mutation (ja existe)

### 2. Dialog de Devolucao (Return) - AssetReturnDialog.tsx
Ao clicar "Devolver":
- Abrir dialog com:
  - Lista dos itens que foram entregues (carregados do assignment atual)
  - Checkbox para conferir cada item
  - Campo de observacao por item
  - Select do novo status: "Em Estoque" ou "Em Manutencao"
- Ao confirmar:
  - Chama `returnAsset` mutation (ja existe)

### 3. Dialog de Manutencao - AssetMaintenanceDialog.tsx
Ao clicar "Manutencao":
- Confirmacao simples com campo de observacao
- Altera status para `em_manutencao` via `updateAsset` mutation
- Registra historico

### 4. Dialog de Baixa - AssetWriteOffDialog.tsx
Ao clicar "Baixa":
- Confirmacao com motivo obrigatorio
- Altera status para `baixado` via `updateAsset` mutation
- Registra historico

### 5. Conectar botao "Editar"
- Abrir o `AssetFormDialog` existente passando o asset como prop (modo edicao)

### 6. Upload de Nota Fiscal
- Adicionar campo de upload no `AssetFormDialog`
- Usar Supabase Storage (bucket `asset-invoices`)
- Salvar `nota_fiscal_path` e `nota_fiscal_url` no asset

### 7. Pagina "Meus Equipamentos" (visao do colaborador)
- Nova pagina em `/patrimonio/meus-equipamentos`
- Lista equipamentos ativos vinculados ao colaborador logado
- Visualizar termos pendentes de aceite
- Botao para aceitar termo (com assinatura digital simples - checkbox de concordancia)

### 8. Atualizar AssetDetailsPage.tsx
- Adicionar estados e handlers para todos os dialogs acima
- Conectar cada botao ao respectivo dialog

## Detalhes tecnicos

### Arquivos a criar

| Arquivo | Descricao |
|---|---|
| `src/components/patrimonio/AssetAssignDialog.tsx` | Dialog de liberacao com checklist |
| `src/components/patrimonio/AssetReturnDialog.tsx` | Dialog de devolucao com conferencia |
| `src/components/patrimonio/AssetMaintenanceDialog.tsx` | Dialog de manutencao |
| `src/components/patrimonio/AssetWriteOffDialog.tsx` | Dialog de baixa |
| `src/pages/patrimonio/MyEquipmentPage.tsx` | Visao do colaborador |

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/pages/patrimonio/AssetDetailsPage.tsx` | Conectar botoes aos dialogs, adicionar estados |
| `src/components/patrimonio/AssetFormDialog.tsx` | Adicionar upload de nota fiscal |
| `src/App.tsx` | Adicionar rota `/patrimonio/meus-equipamentos` |

### Nota sobre relatorios

Os relatorios (equipamentos por setor, sem colaborador, etc.) podem ser adicionados como filtros na listagem existente ou como uma pagina separada de relatorios. A listagem atual ja suporta filtro por status e tipo. Para "por setor" e "sem colaborador" seria necessario JOINs adicionais no hook `useAssets`.

