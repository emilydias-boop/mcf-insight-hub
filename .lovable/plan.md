

# Corrigir Deals Sem Estágio (stage_id NULL)

## Diagnóstico

O deal "Júnior Pandolfi" (email: pj.investimentosimobiliarios@outlook.com) na origem "Efeito Alavanca + Clube" tem `stage_id = NULL`. Isso faz com que ele apareça na contagem da busca ("1 oportunidade"), mas não seja exibido em nenhuma coluna do Kanban.

Existem **73 deals** nessa mesma situação só nessa origem, e mais **1616 deals** sem origin_id/stage_id em geral.

## Causa raiz

A sincronização do Clint (`sync-deals`) não encontrou o mapeamento de estágio para esses deals. A variável `stageId` ficou `null` e foi salva assim no banco.

## Plano

### 1. Corrigir dados existentes (Edge Function pontual)

Criar uma edge function temporária `fix-null-stages` que:
- Busca todos os deals com `stage_id IS NULL` e `origin_id IS NOT NULL`
- Para cada origin_id, busca o primeiro estágio ativo (menor `stage_order`)
- Atualiza os deals atribuindo esse estágio padrão
- Retorna um relatório de quantos deals foram corrigidos por origem

### 2. Prevenir no sync futuro

No arquivo `supabase/functions/sync-deals/index.ts`:
- Quando `stageId` resolver como `null` mas `originId` existir, buscar o primeiro estágio ativo da origem como fallback
- Isso garante que novos deals sincronizados nunca fiquem sem estágio

### 3. Tratar no frontend (Kanban)

No `DealKanbanBoardInfinite.tsx`:
- Adicionar uma seção "Sem estágio" no final do Kanban para deals com `stage_id = null`, caso existam
- Isso serve como safety net para que nenhum deal fique invisível

## Detalhes técnicos

### Nova Edge Function: `supabase/functions/fix-null-stages/index.ts`

```
POST /fix-null-stages
```

Lógica:
1. Query: `SELECT DISTINCT origin_id FROM crm_deals WHERE stage_id IS NULL AND origin_id IS NOT NULL`
2. Para cada origin_id: buscar primeiro estágio com `is_active = true ORDER BY stage_order ASC LIMIT 1`
3. UPDATE em batch: `UPDATE crm_deals SET stage_id = ? WHERE stage_id IS NULL AND origin_id = ?`
4. Retornar contagem de deals corrigidos

### Arquivo: `supabase/functions/sync-deals/index.ts`

Após a linha onde `stageId` é resolvido (linha ~231), adicionar fallback:

```typescript
// Se não encontrou stage pelo mapeamento, usar primeiro estágio da origem
let stageId = stageData?.id || null;
let originId = stageData?.origin_id || null;

if (!stageId && originId) {
  // Fallback: buscar primeiro estágio ativo da origem
  const { data: defaultStage } = await supabaseClient
    .from('crm_stages')
    .select('id')
    .eq('origin_id', originId)
    .eq('is_active', true)
    .order('stage_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (defaultStage) stageId = defaultStage.id;
}
```

### Arquivo: `src/components/crm/DealKanbanBoardInfinite.tsx`

Adicionar coluna "Sem Estágio" como safety net visual:

```typescript
const unstaged = deals.filter(d => !d.stage_id);
// Renderizar como ultima coluna se unstaged.length > 0
```

