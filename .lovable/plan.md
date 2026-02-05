
# Plano: Correção Completa do Filtro de Tags

## Problemas Identificados

### 1. Inconsistência de Escopo entre Hooks
O hook `useCRMDeals` verifica se `originId` é um grupo e busca todas as origens filhas:
```typescript
// useCRMDeals trata grupos corretamente
if (groupCheck) {
  const { data: childOrigins } = await supabase
    .from('crm_origins').select('id').eq('group_id', filters.originId);
  originIds = childOrigins?.map(o => o.id) || [];
}
```

Mas `useUniqueDealTags` **NÃO** faz isso:
```typescript
// useUniqueDealTags não trata grupos!
if (originId) {
  query = query.eq('origin_id', originId); // Falha se originId for um grupo
}
```

Isso pode causar deals visíveis cujas tags não estão disponíveis no filtro.

### 2. Falta de Validação de Tipo nas Tags
O código assume que `deal.tags` é sempre um array de strings, mas pode conter valores `null` ou tipos inesperados.

---

## Alterações Necessárias

### Arquivo 1: `src/hooks/useUniqueDealTags.ts`

Atualizar para tratar grupos da mesma forma que `useCRMDeals`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseUniqueDealTagsOptions {
  originId?: string;
  enabled?: boolean;
}

export const useUniqueDealTags = (options: UseUniqueDealTagsOptions = {}) => {
  const { originId, enabled = true } = options;

  return useQuery({
    queryKey: ['unique-deal-tags', originId],
    queryFn: async () => {
      let originIds: string[] = [];

      // Verificar se originId é um grupo (mesma lógica de useCRMDeals)
      if (originId) {
        const { data: groupCheck } = await supabase
          .from('crm_groups')
          .select('id')
          .eq('id', originId)
          .maybeSingle();

        if (groupCheck) {
          // É um grupo - buscar todas as origens filhas
          const { data: childOrigins } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('group_id', originId);

          originIds = childOrigins?.map(o => o.id) || [];
        } else {
          // É uma origem normal
          originIds = [originId];
        }
      }

      let query = supabase
        .from('crm_deals')
        .select('tags')
        .not('tags', 'is', null);

      // Aplicar filtro de origens (múltiplas se for grupo)
      if (originIds.length > 0) {
        query = query.in('origin_id', originIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Extrair e deduplicar todas as tags (com validação de tipo)
      const allTags = (data || []).flatMap((d) => 
        (d.tags || []).filter((t): t is string => typeof t === 'string' && t.trim() !== '')
      );
      const uniqueTags = [...new Set(allTags)].sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
      );

      return uniqueTags.slice(0, 500);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
```

---

### Arquivo 2: `src/pages/crm/Negocios.tsx`

Atualizar o filtro de tags (linhas 430-448) com validação de tipo mais rigorosa:

```typescript
// Filtro por tags selecionadas (com normalização e validação de tipo)
if (filters.selectedTags.length > 0) {
  // Garantir que tags é um array válido
  const dealTags = Array.isArray(deal.tags) ? deal.tags : [];
  
  // Normalização avançada: remove acentos, padroniza separadores
  const normalizeTag = (t: unknown): string => {
    if (typeof t !== 'string') return '';
    return t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .trim()
      .toLowerCase();
  };
  
  const normalizedSelectedTags = filters.selectedTags.map(normalizeTag).filter(Boolean);
  const normalizedDealTags = dealTags.map(normalizeTag).filter(Boolean);
  
  // Se nenhuma tag selecionada é válida, não filtrar
  if (normalizedSelectedTags.length === 0) {
    // Skip tag filter if all selected tags are invalid
  } else {
    const hasMatchingTag = normalizedSelectedTags.some(selectedTag => 
      normalizedDealTags.includes(selectedTag)
    );
    if (!hasMatchingTag) return false;
  }
}
```

---

## Fluxo Corrigido

```text
Usuário seleciona pipeline (pode ser grupo ou origem)
    |
    V
useCRMDeals: Verifica se é grupo → busca origens filhas → retorna deals
useUniqueDealTags: Verifica se é grupo → busca origens filhas → retorna tags
    |
    V
Ambos usam o MESMO conjunto de origens
    |
    V
Tags disponíveis = tags dos mesmos deals exibidos ✓
    |
    V
Filtro normaliza e compara corretamente
    |
    V
Apenas deals com a tag selecionada aparecem
```

---

## Resultado Esperado

1. **Consistência**: Tags disponíveis sempre correspondem aos deals visíveis
2. **Robustez**: Validação de tipo previne erros silenciosos
3. **Precisão**: Filtro exclui corretamente deals sem a tag selecionada
