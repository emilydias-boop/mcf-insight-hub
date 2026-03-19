

## Plano: Mostrar nomes dos estágios ao invés de UUIDs na Timeline

### Problema

Algumas `deal_activities` armazenam UUIDs em `from_stage`/`to_stage` (vindas de syncs automáticos como `agenda_sync`), enquanto outras armazenam o nome legível. A timeline exibe esses UUIDs sem resolução.

### Correção

**Arquivo: `src/hooks/useLeadFullTimeline.ts`**

1. Após buscar as activities, coletar todos os valores de `from_stage`/`to_stage` que parecem ser UUIDs (regex de UUID)
2. Fazer uma query única em `crm_stages` para resolver UUID → `stage_name`
3. Usar o mapa de resolução ao construir o `title` e `metadata` dos eventos `stage_change`

Lógica:
```
const isUUID = /^[0-9a-f]{8}-/i;
const uuidsToResolve = new Set<string>();
// collect UUIDs from from_stage/to_stage
// query crm_stages WHERE id IN (uuids)
// build stageNameMap: Record<string, string>
// use: stageNameMap[stage] || stage
```

Isso resolve tanto o título (`from → to`) quanto os badges de metadata no `LeadFullTimeline.tsx`, sem alterar o componente de UI.

