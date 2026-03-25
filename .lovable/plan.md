

## Substituir filtro Pipeline por filtro de Tags no Controle Diego

### Problema
O filtro de Pipeline mostra todas as origens do sistema (incluindo de outras BUs), quando deveria mostrar apenas as da BU ativa. Além disso, o filtro mais útil seria por **Tags** dos contatos (ex: anamnese, seguimentos), não por pipeline.

### Alterações

#### `src/components/relatorios/ControleDiegoPanel.tsx`

1. **Remover** estado `selectedOriginId` e a query de `crm-origins-list`
2. **Adicionar** estado `selectedTags: string[]` para filtro por tags
3. **Adicionar** `contactTags: string[]` ao tipo `KanbanRow` e mapeá-lo dos dados
4. **Extrair tags únicas** dos dados carregados para popular o filtro
5. **Substituir** o `<Select>` de Pipeline pelo componente `TagFilterPopover` já existente
6. **Aplicar filtro client-side**: se há tags selecionadas, mostrar apenas rows cujo `contactTags` contenha pelo menos uma das tags selecionadas
7. **Atualizar** dependências do `useMemo` e lógica de export (PDF/Excel) para refletir tags em vez de pipeline

### Resultado
O filtro de Pipeline será substituído por um filtro multi-select de Tags que permite filtrar por anamnese, seguimentos e demais tags dos contatos, usando o componente `TagFilterPopover` já disponível no projeto.

