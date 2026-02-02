
# Plano: Mostrar Todos os Funis do Consórcio na Sidebar

## Problema Identificado

A sidebar de funis do Consórcio não mostra os pipelines porque há um conflito entre:

1. **Deduplicação por nome**: O `useCRMPipelines()` (linha 37-44 no `PipelineSelector.tsx`) deduplica grupos por nome usando `.trim().toLowerCase()`, mantendo apenas o **mais recente** de cada
2. **Mapeamento no banco**: A tabela `bu_origin_mapping` aponta para IDs específicos (alguns mais antigos) que podem ser **eliminados pela deduplicação**

### Exemplo Real:
| ID | Nome | Mantido? |
|---|---|---|
| `35361575...` | " Hubla - Construir Para Alugar" (espaço no início) | Eliminado pela deduplicação |
| `a5f6b08b...` | "Hubla - Construir para Alugar" | Mantido (mais recente) |

O mapeamento usa `35361575...`, mas o selector só tem `a5f6b08b...` após deduplicação.

---

## Solução

### Opção Escolhida: Ajustar a Lógica de Filtragem

Em vez de filtrar apenas por ID exato, também verificar se o **nome** do grupo/origem corresponde ao esperado. Isso torna o sistema resiliente à deduplicação.

### Alterações:

**1. `src/components/crm/PipelineSelector.tsx`**

Modificar a filtragem para considerar IDs OU nomes correspondentes:

```typescript
// Antes (linha 59-64):
const filteredPipelines = useMemo(() => {
  if (!allowedGroupIds || allowedGroupIds.length === 0) {
    return pipelines;
  }
  return pipelines?.filter(p => allowedGroupIds.includes(p.id));
}, [pipelines, allowedGroupIds]);

// Depois:
const filteredPipelines = useMemo(() => {
  if (!allowedGroupIds || allowedGroupIds.length === 0) {
    return pipelines; // Sem filtro = admin vê tudo
  }
  // Incluir grupos que estão na lista de IDs permitidos
  // OU cujo nome normalizado corresponde a um grupo permitido
  return pipelines?.filter(p => allowedGroupIds.includes(p.id));
}, [pipelines, allowedGroupIds]);
```

**2. `src/hooks/useBUPipelineMap.ts`**

Adicionar lógica para **resolver nomes** além de IDs, garantindo que mesmo que o ID mude, o sistema encontre o grupo correto:

```typescript
// Buscar também os nomes dos grupos mapeados para matching
const groupNames = await supabase
  .from('crm_groups')
  .select('id, name, display_name')
  .in('id', groupIds);
```

**3. Abordagem Alternativa Mais Simples**

Como o problema é específico de dados duplicados, a solução mais pragmática é:

- **Remover a deduplicação** quando há filtro de BU ativo
- OU **atualizar o mapeamento** para usar os IDs corretos

### Alterações de Código:

**Arquivo: `src/components/crm/PipelineSelector.tsx`**

Modificar para não aplicar deduplicação quando houver filtro de BU, permitindo que todos os grupos mapeados apareçam:

```typescript
export const useCRMPipelines = (skipDedup = false) => {
  return useQuery({
    queryKey: ['crm-pipelines', skipDedup],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_groups')
        .select('id, name, display_name, created_at, is_archived')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!data) return [];
      
      const activeGroups = data.filter(g => g.is_archived !== true);
      
      // Se skipDedup=true, pular deduplicação
      if (skipDedup) {
        return activeGroups.sort((a, b) => 
          (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name)
        );
      }
      
      // Deduplicar por nome (comportamento original)
      const seen = new Map();
      activeGroups.forEach(g => {
        const key = (g.display_name ?? g.name).trim().toLowerCase();
        if (!seen.has(key)) seen.set(key, g);
      });
      
      return Array.from(seen.values()).sort((a, b) => 
        (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name)
      );
    },
  });
};
```

**Arquivo: `src/pages/crm/Negocios.tsx`**

Passar `skipDedup=true` quando houver filtro de BU:

```typescript
const { data: pipelines } = useCRMPipelines(!!activeBU);
```

---

## Resumo Técnico

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/PipelineSelector.tsx` | Adicionar parâmetro `skipDedup` ao hook `useCRMPipelines` |
| `src/pages/crm/Negocios.tsx` | Usar `useCRMPipelines(!!activeBU)` para pular deduplicação quando BU ativa |
| `src/components/crm/OriginsSidebar.tsx` | Propagar a lógica de skip dedup |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Consórcio abre Negócios | Dropdown vazio / só 1 item | Mostra 5 funis mapeados |
| Incorporador abre Negócios | Mostra funis normais | Mantém igual |
| Admin sem BU | Vê todos deduplicados | Mantém igual |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  SDR do Consórcio acessa /consorcio/crm/negocios                    │
│  1. useActiveBU() → 'consorcio'                                     │
│  2. useBUPipelineMap('consorcio') → retorna grupos do banco         │
│  3. useCRMPipelines(skipDedup=true) → NÃO deduplica                 │
│  4. PipelineSelector filtra por allowedGroupIds                     │
│  5. Dropdown mostra:                                                │
│     - Perpétuo - Construa para Alugar                               │
│     - Hubla - Viver de Aluguel                                      │
│     - Hubla - Construir Para Alugar                                 │
│     - Hubla - Sócios MCF                                            │
│     - BU - Consórcio (se existir)                                   │
│  6. Sidebar mostra origens de cada grupo ✓                          │
└─────────────────────────────────────────────────────────────────────┘
```
