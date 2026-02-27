

## Plano: Corrigir pipeline padrão do Incorporador

### Problema identificado
A `bu_origin_mapping` do incorporador tem apenas 1 grupo mapeado: **"Perpétuo - X1"** (`a6f3cbfc`). A pipeline principal **"PIPELINE INSIDE SALES"** (`e3c04f21`) é uma `crm_origins` (não um grupo) e **não está mapeada** na tabela.

O efeito `hasSinglePipeline` (adicionado no último edit) detecta `buAllowedGroups.length === 1`, auto-seleciona "Perpétuo - X1", e seta `hasSetDefault.current = true` — impedindo que o fallback `BU_DEFAULT_ORIGIN_MAP['incorporador']` execute.

### Correções

#### 1. Adicionar "PIPELINE INSIDE SALES" ao `bu_origin_mapping`
Inserir o origin `e3c04f21-ba2c-4c66-84f8-b4341c826b1c` como mapeamento do incorporador com `is_default: true`.

#### 2. Unificar lógica de default em `Negocios.tsx`
Remover o `useEffect` separado de `hasSinglePipeline` (linhas ~547-551) e integrar a lógica dentro do useEffect principal de default (linhas 157-188):
- Se `hasSinglePipeline` e `buMapping.defaultOrigin` existe → usar o `defaultOrigin`
- Se `hasSinglePipeline` e não tem `defaultOrigin` → usar `buAllowedGroups[0]`
- Caso contrário → manter fluxo atual (SDR check → BU_DEFAULT_ORIGIN_MAP → fallback Inside Sales)

Isso garante que a prioridade é sempre: **default mapeado no banco > grupo único > fallback hardcoded**.

