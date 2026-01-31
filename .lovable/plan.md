

# Plano: Filtro de Tags na Pipeline de Negócios

## Objetivo
Adicionar um filtro de tags na página de Negócios (Pipeline Kanban) que permite selecionar uma ou mais tags para filtrar os deals exibidos.

---

## Análise do Sistema Atual

### Estrutura de Tags nos Deals
- O campo `tags` em `crm_deals` é um **array de strings** (ex: `['A010', 'Lead-Lançamento', 'BIO']`)
- Existem centenas de tags únicas no sistema (A010, Lead-Lançamento, BIO, produtos MCF, etc.)
- As tags são usadas para classificar leads por canal de entrada, produto, status, etc.

### Componente de Filtros Atual
O `DealFilters.tsx` já possui filtros para:
- Busca por texto
- Status (Abertos/Ganhos/Perdidos)
- Responsável
- Inatividade
- Canal de Entrada (A010/BIO/LIVE)
- Tentativas de ligação
- Data de criação

---

## Mudanças Propostas

### 1. Atualizar Interface de Filtros (`DealFiltersState`)

Adicionar campo `selectedTags` ao tipo:

```text
DealFiltersState {
  ...
  selectedTags: string[];  // NOVO: Array de nomes de tags selecionadas
}
```

### 2. Criar Hook para Buscar Tags Únicas

Novo hook `useUniqueDealTags.ts`:
- Buscar todas as tags únicas de `crm_deals` (opcional: filtrar por origin_id)
- Cachear com React Query
- Ordenar alfabeticamente

### 3. Criar Componente TagFilterPopover

Novo componente baseado no padrão do filtro de Tentativas:
- Botão com ícone de Tag e badge com contagem de selecionados
- Popover com lista de checkboxes das tags disponíveis
- Campo de busca para filtrar tags na lista
- Suporte a seleção múltipla

### 4. Atualizar DealFilters.tsx

Adicionar:
- Importar o novo componente `TagFilterPopover`
- Adicionar o botão de filtro de tags entre os filtros existentes
- Incluir `selectedTags` na contagem de filtros ativos

### 5. Atualizar Negocios.tsx

Adicionar:
- Estado inicial `selectedTags: []` no objeto `filters`
- Lógica de filtragem no `useMemo` de `filteredDeals`:
  ```text
  if (filters.selectedTags.length > 0) {
    const dealTags = deal.tags || [];
    const hasMatchingTag = filters.selectedTags.some(tag => 
      dealTags.includes(tag)
    );
    if (!hasMatchingTag) return false;
  }
  ```
- Resetar `selectedTags` no `clearFilters`

---

## Interface Visual

A área de filtros ficará:

```text
[Buscar...] [Status] [Responsável] [Inatividade] [Canal] [Tentativas] [📍 Tags (N)] [📅 Data] [X Limpar]
```

O botão "Tags" mostrará:
- Ícone de tag
- Texto "Tags" quando nenhuma selecionada
- Badge com número quando houver seleção (ex: "Tags (3)")

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useUniqueDealTags.ts` | **Criar** - Hook para buscar tags únicas |
| `src/components/crm/TagFilterPopover.tsx` | **Criar** - Componente de seleção de tags |
| `src/components/crm/DealFilters.tsx` | **Modificar** - Adicionar campo e componente |
| `src/pages/crm/Negocios.tsx` | **Modificar** - Adicionar estado e lógica de filtro |

---

## Seção Técnica

### Hook useUniqueDealTags

```typescript
// Busca tags únicas diretamente do banco
const { data, error } = await supabase
  .from('crm_deals')
  .select('tags')
  .not('tags', 'is', null);

// Extrair e deduplicar
const allTags = data?.flatMap(d => d.tags || []) || [];
const uniqueTags = [...new Set(allTags)].sort();
```

### Lógica de Filtragem

A filtragem será feita no frontend (como os outros filtros) usando `Array.some()`:

```typescript
// No filteredDeals useMemo
if (filters.selectedTags.length > 0) {
  const dealTags = deal.tags || [];
  // Match se o deal tiver QUALQUER uma das tags selecionadas (OR)
  const hasMatch = filters.selectedTags.some(t => dealTags.includes(t));
  if (!hasMatch) return false;
}
```

### Otimização

- O hook `useUniqueDealTags` pode receber um `originId` opcional para limitar as tags ao pipeline atual
- Cache de 5 minutos com `staleTime` para evitar requisições repetidas
- Limite de 500 tags para evitar sobrecarga visual (tags mais comuns primeiro)

