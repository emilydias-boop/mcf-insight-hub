

## Plano: Trocar grid de cards por lista/tabela com paginação

### Problema
O grid de cards com infinite scroll é lento para 110k+ contatos, especialmente quando precisa carregar tudo para filtros de parceria. Uma visualização em lista com paginação server-side resolve a performance.

### Alterações

**`src/hooks/useContactsEnriched.ts`**
- Substituir `useInfiniteQuery` por `useQuery` com paginação offset
- Aceitar `page` e `pageSize` como parâmetros
- Usar `count: 'exact'` no Supabase para obter total de registros
- Retornar `{ contacts: EnrichedContact[], totalCount: number }`
- Manter deduplicação e enriquecimento por página

**`src/pages/crm/Contatos.tsx`**
- Adicionar states: `currentPage` (1), `pageSize` (50)
- Remover toda lógica de auto-fetch/infinite scroll (`isLoadingAll`, `wantsSelectAll`, useEffects de loop)
- Trocar grid de `ContactCard` por tabela compacta em lista (linhas com: checkbox, nome, email, telefone, org, status térmico, deal/etapa, SDR, closer, parceria)
- Adicionar componente `Pagination` (já existe em `ui/pagination.tsx`) no rodapé
- Adicionar `Select` de pageSize: 25, 50, 100, 200
- Mostrar "Mostrando 51-100 de 2000 contatos"
- Reset page=1 ao mudar filtros/busca
- "Selecionar todos" opera sobre a página atual

**`src/components/crm/ContactCard.tsx`**
- Mantido para uso futuro, mas não usado na lista

### Layout da lista

```text
☐ | Nome          | Email              | Telefone    | Org    | Status | Etapa     | SDR   | Closer | Parceria
──────────────────────────────────────────────────────────────────────────────────────────────────────────────
☐ | João Silva    | joao@email.com     | 11999...    | XPTO   | 🟢     | Agendado  | Maria | Pedro  | A001
☐ | Ana Costa     | ana@email.com      | 21988...    | ABC    | 🔴     | No-show   | Lucas | —      | —
```

Paginação: `< 1 2 3 ... 40 >  |  Mostrando 50 por página  |  Total: 2000`

### Fluxo
1. Página carrega 50 contatos rapidamente (1 query)
2. Usuário navega entre páginas ou muda pageSize
3. Filtros resetam para page=1
4. "Selecionar todos" seleciona os da página atual
5. Clique na linha abre o drawer 360°

