

## Plano: Filtrar por data de entrada da tag (não apenas data de criação do deal)

### Problema

Hoje, ao combinar filtro de tags (ex: ANAMNESE) + data de criação, o sistema só mostra deals **criados** naquele período. Deals antigos que **receberam** a tag ANAMNESE naquele período não aparecem.

### Desafio técnico

Não existe uma tabela de histórico de tags (ex: `tag_added_at`) no sistema atual. A única pista de quando um deal foi modificado é o campo `updated_at`.

### Solução proposta

Quando **tags estão selecionadas** E **dateRange está ativo**, mudar o comportamento do filtro de data:

- Em vez de filtrar apenas por `created_at`, filtrar por **`created_at` OU `updated_at`** dentro do período
- Isso captura tanto deals novos quanto deals existentes que foram atualizados (tag adicionada) no período selecionado

Adicionalmente, renomear o label do filtro de data para indicar essa mudança de comportamento quando tags estão ativas.

### Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/pages/crm/Negocios.tsx` (~linhas 393-405) | Quando `filters.selectedTags.length > 0`, o filtro de dateRange passa a verificar `created_at OU updated_at` dentro do range, em vez de apenas `created_at` |
| `src/components/crm/DealFilters.tsx` | Adicionar indicação visual (tooltip ou label) de que a data filtra por "criação ou atualização" quando tags estão selecionadas |

### Lógica do filtro (Negocios.tsx)

```typescript
// Filtro por data
if (filters.dateRange?.from) {
  const fromDate = new Date(filters.dateRange.from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = filters.dateRange.to 
    ? new Date(filters.dateRange.to) 
    : new Date(filters.dateRange.from);
  toDate.setHours(23, 59, 59, 999);

  if (filters.selectedTags.length > 0) {
    // Com tags ativas: deal criado OU atualizado no período
    const dealCreated = new Date(deal.created_at);
    const dealUpdated = new Date(deal.updated_at);
    const inRange = (d: Date) => d >= fromDate && d <= toDate;
    if (!inRange(dealCreated) && !inRange(dealUpdated)) return false;
  } else {
    // Sem tags: filtro padrão por created_at
    const dealDate = new Date(deal.created_at);
    if (dealDate < fromDate || dealDate > toDate) return false;
  }
}
```

### Resultado esperado

- Filtrar ANAMNESE + 21-23/Mar mostra:
  - Deals **criados** entre 21 e 23/Mar com tag ANAMNESE
  - Deals **antigos** que foram **atualizados** (tag ANAMNESE adicionada) entre 21 e 23/Mar
- Sem tags selecionadas, o filtro de data continua funcionando como antes (só `created_at`)

### Limitação

Como não há registro granular de quando cada tag foi adicionada, o sistema usa `updated_at` como proxy. Isso pode incluir deals atualizados por outros motivos (mudança de stage, edição de campos) no mesmo período. Para precisão total, seria necessário criar uma tabela `deal_tag_history` futuramente.

