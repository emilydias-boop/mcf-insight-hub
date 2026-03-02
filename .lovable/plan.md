
## Diagnóstico

Linha 525-528 de `process-csv-imports/index.ts`:
```typescript
if (csvDeal.stage) {
  const stageId = stagesCache.get(csvDeal.stage.toLowerCase())
  if (stageId) dbDeal.stage_id = stageId
}
// Se não tem coluna 'stage' no CSV → stage_id = undefined → entra sem estágio
```

CSVs da Hubla não têm coluna `stage`, então **100% dos deals importados entram com `stage_id = null`** e caem na coluna "⚠️ Sem Estágio" do Kanban — visível mas sem estágio definido.

## Solução: Seletor de Estágio Padrão na tela de importação

Quando o CSV não tiver coluna `stage` (ou o valor não bater com nenhum estágio), usar o **estágio padrão selecionado pelo usuário**.

---

### 1. `src/pages/crm/ImportarNegocios.tsx`

**Novo estado e query:**
```typescript
const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

// Query de estágios da pipeline selecionada
const { data: stagesForOrigin } = useQuery({
  queryKey: ['stages-for-origin', selectedOriginId],
  enabled: !!selectedOriginId,
  queryFn: async () => {
    const { data } = await supabase
      .from('local_pipeline_stages')
      .select('id, name')
      .eq('origin_id', selectedOriginId)
      .eq('is_active', true)
      .order('stage_order');
    return data || [];
  }
});
```

**Resetar estágio quando pipeline mudar:**
```typescript
useEffect(() => {
  setSelectedStageId(null);
}, [selectedOriginId]);
```

**Novo seletor na UI** (entre pipeline e responsável):
```tsx
<div className="space-y-2">
  <Label>Estágio padrão (opcional)</Label>
  <Select value={selectedStageId || ''} onValueChange={v => setSelectedStageId(v || null)}>
    <SelectTrigger>
      <SelectValue placeholder="Selecione um estágio padrão" />
    </SelectTrigger>
    <SelectContent>
      {stagesForOrigin?.map(s => (
        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    Usado quando o CSV não tem coluna "stage". Se vazio, deals entram sem estágio.
  </p>
</div>
```

**Passar `default_stage_id` no FormData:**
```typescript
if (selectedStageId) {
  formData.append('default_stage_id', selectedStageId);
}
```

---

### 2. `supabase/functions/import-deals-csv/index.ts`

Ler e salvar `default_stage_id` no metadata do job:
```typescript
const defaultStageId = formData.get('default_stage_id') as string | null;
// ...
metadata: { ..., default_stage_id: defaultStageId || null }
```

---

### 3. `supabase/functions/process-csv-imports/index.ts`

Usar o `default_stage_id` do metadata quando o CSV não mapear estágio:
```typescript
// ANTES
if (csvDeal.stage) {
  const stageId = stagesCache.get(csvDeal.stage.toLowerCase())
  if (stageId) dbDeal.stage_id = stageId
}

// DEPOIS
const defaultStageId = job.metadata.default_stage_id || null
if (csvDeal.stage) {
  const stageId = stagesCache.get(csvDeal.stage.toLowerCase())
  dbDeal.stage_id = stageId || defaultStageId || undefined
} else if (defaultStageId) {
  dbDeal.stage_id = defaultStageId
}
```

---

## Arquivos a modificar
- `src/pages/crm/ImportarNegocios.tsx` — novo seletor de estágio + query de estágios por pipeline + passar no FormData
- `supabase/functions/import-deals-csv/index.ts` — ler e salvar `default_stage_id` no metadata
- `supabase/functions/process-csv-imports/index.ts` — usar `default_stage_id` como fallback no `convertToDBFormat`
- Re-deploy das duas edge functions
