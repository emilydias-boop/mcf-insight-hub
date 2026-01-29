

# Plano de Correção: Stages do Leilão não aparecem no Kanban

## Problema Identificado

As stages do CRM do Leilão não aparecem porque o sistema de **permissões de stages** não consegue reconhecê-las:

### Fluxo do problema:

1. O `DealKanbanBoard` filtra stages por permissão: `activeStages.filter(s => canViewStage(s.id))`

2. A função `canViewStage` no hook `useStagePermissions` tenta encontrar permissões por:
   - **UUID direto** → Não encontra (tabela `stage_permissions` usa IDs como `novo_lead`, `lead_qualificado`)
   - **Fallback por nome** → Busca no `stagesMap` que vem de `crm_stages`

3. **As stages do Leilão estão em `local_pipeline_stages`**, não em `crm_stages`, então o `stagesMap` não as conhece

4. Resultado: `canViewStage` retorna `false` para todas as stages do Leilão → **nenhuma coluna aparece**

## Solução

Atualizar o hook `useStagePermissions` para incluir stages de `local_pipeline_stages` no mapeamento UUID → nome.

---

## Alterações Necessárias

### Arquivo: `src/hooks/useStagePermissions.ts`

Atualizar a query `stages-map` para incluir dados de ambas as tabelas:

**Antes (linha 126-139):**
```typescript
const { data: stagesMap = {}, isLoading: stagesLoading } = useQuery({
  queryKey: ['stages-map'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('crm_stages')
      .select('id, stage_name');
    
    if (error) throw error;
    
    const map: Record<string, string> = {};
    data?.forEach(s => { map[s.id] = s.stage_name; });
    return map;
  },
});
```

**Depois:**
```typescript
const { data: stagesMap = {}, isLoading: stagesLoading } = useQuery({
  queryKey: ['stages-map'],
  queryFn: async () => {
    // Buscar de ambas as tabelas
    const [crmRes, localRes] = await Promise.all([
      supabase.from('crm_stages').select('id, stage_name'),
      supabase.from('local_pipeline_stages').select('id, name'),
    ]);
    
    const map: Record<string, string> = {};
    
    // Mapear crm_stages
    crmRes.data?.forEach(s => { 
      map[s.id] = s.stage_name; 
    });
    
    // Mapear local_pipeline_stages (name → stage_name)
    localRes.data?.forEach(s => { 
      map[s.id] = s.name; 
    });
    
    return map;
  },
});
```

---

## Por que isso resolve?

1. O `stagesMap` agora incluirá os UUIDs das stages do Leilão:
   - `ef930b3b-abc1-41d9-8d41-dcace0793cb7` → `Novo Lead`
   - `a973963d-669e-452f-9e5a-f4cb4ddf9858` → `Lead Qualificado`
   - `bef6f4db-a2ee-444f-90f7-0e03d0246f34` → `Sem Interesse`
   - (etc.)

2. O fallback da função `findPermission` vai funcionar:
   - UUID `ef930b3b-...` → nome `Novo Lead` → normalizado `novo_lead`
   - Encontra permissão em `stage_permissions` com `stage_id = 'novo_lead'`
   - Retorna `can_view: true`

3. As stages aparecem no Kanban!

---

## Resumo

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useStagePermissions.ts` | Atualizar query `stages-map` para incluir `local_pipeline_stages` |

