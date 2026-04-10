

# Busca + Paginação na aba Acumulados

## Alterações

**Arquivo:** `src/components/crm/R2AccumulatedList.tsx`

### 1. Campo de busca
Adicionar um `Input` com ícone de `Search` acima da tabela, ao lado dos filtros de tipo. A busca filtra client-side por:
- Nome (`attendee_name`, `deal_name`)
- Telefone (`attendee_phone`, `contact_phone`)
- E-mail (`contact_email`)

Busca case-insensitive, aplicada após o filtro de tipo.

### 2. Paginação
- Seletor de itens por página: 20, 50, 100
- Controles Anterior/Próximo com indicador "Página X de Y"
- Estado local: `currentPage` (reset ao mudar filtro/busca), `pageSize`
- Slice dos resultados filtrados: `filteredLeads.slice((page-1)*size, page*size)`

### 3. Layout
```text
[🔍 Buscar por nome, telefone ou email...    ] [Tipo: Todos | Próx. Semana | Sem R2]

[Tabela com leads paginados]

[◀ Anterior] Página 1 de 4 [Próximo ▶]  |  Exibindo 20 por página [20 ▼]
```

### Detalhes técnicos
- Imports adicionais: `Input` de `@/components/ui/input`, `Search` de `lucide-react`, `Select` para page size
- Contadores nos botões de tipo continuam refletindo o total (não paginado), mas consideram a busca
- `useMemo` para performance do filtro de busca + tipo combinados

