

## Filtro Avançado de Tags — Lógica E/OU com "Possui" e "Não possui"

### O que será construído
Substituir o filtro de tags atual (simples checklist) por um filtro avançado inspirado no Clint CRM, com:

1. **Modo E / OU** — Toggle entre critério AND (todas as condições) e OR (qualquer condição)
2. **Condições por tag** — Cada tag adicionada pode ser "Possui a tag X" ou "Não possui a tag X"
3. **Múltiplas condições** — Adicionar várias regras de tag combinadas pelo operador escolhido
4. **Botão "Limpar filtros"** para resetar

### Exemplo de uso
- Filtro: `E` → "Possui tag ANAMNESE" + "Não possui tag entrou-grupo" → mostra apenas deals com ANAMNESE que NÃO têm "entrou-grupo"
- Filtro: `OU` → "Possui tag A010" OU "Possui tag ANAMNESE" → mostra deals com qualquer uma das duas

### Mudanças técnicas

**1. Novo tipo de filtro** (`DealFiltersState` em `DealFilters.tsx`)
- Substituir `selectedTags: string[]` por `tagFilters: TagFilterRule[]`
- `TagFilterRule = { tag: string; mode: 'has' | 'not_has' }`
- Adicionar `tagOperator: 'and' | 'or'` (default: `'and'`)

**2. Novo componente `TagFilterPopover.tsx`** — Reescrever com:
- Toggle E/OU no topo
- Lista de condições adicionadas (com botão X para remover cada)
- Seletor de tag (busca + lista) com opção "Possui tag" / "Não possui tag"
- Botão "Limpar filtros"

**3. Lógica de filtragem** (`Negocios.tsx`, linhas ~500-527)
- Se `tagOperator === 'and'`: todas as regras devem ser satisfeitas
- Se `tagOperator === 'or'`: pelo menos uma regra deve ser satisfeita
- Regra `has`: deal DEVE ter a tag
- Regra `not_has`: deal NÃO DEVE ter a tag

**4. Reset** — Atualizar `emptyFilters` para incluir `tagFilters: [], tagOperator: 'and'`

### Arquivos afetados
- `src/components/crm/TagFilterPopover.tsx` — Reescrever completamente
- `src/components/crm/DealFilters.tsx` — Atualizar tipo e props
- `src/pages/crm/Negocios.tsx` — Atualizar lógica de filtragem e estado inicial
- `src/components/relatorios/ControleDiegoPanel.tsx` — Adaptar uso do componente (compatibilidade)

