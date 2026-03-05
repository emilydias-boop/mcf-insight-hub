

## Plano: Fluxo BU → Funil → Pipeline → Etapa no modal

### Problema
O modal "Enviar para Pipeline" pula o nível de Funil (grupo). Ao selecionar uma BU como Consórcio, mostra diretamente todas as origens (pipelines) misturadas. O fluxo correto deve ser hierárquico: **BU → Funil (grupo) → Pipeline (origem) → Etapa**.

### Alteração

**`src/components/crm/SendToPipelineModal.tsx`** — Adicionar passo intermediário de Funil

1. Adicionar state `selectedGroupId`
2. Após selecionar BU, buscar os **grupos** (funis) mapeados para essa BU via `useBUPipelineMap` + query em `crm_groups`
3. Novo Select "Funil" que lista os grupos da BU (ex: "BU - Consorcio", "Perpétuo - X1", "Hubla - Construir Para Alugar")
4. Após selecionar funil, buscar as **origens** filhas desse grupo via `crm_origins.group_id`
5. Select "Pipeline" agora mostra apenas origens do grupo selecionado
6. Resetar cascata: mudar BU limpa funil/pipeline/etapa; mudar funil limpa pipeline/etapa

### Fluxo final
```text
BU (Consórcio) → Funil (BU - Consorcio) → Pipeline (origem) → Etapa (stage)
```

### Arquivos
- `src/components/crm/SendToPipelineModal.tsx` — única alteração

