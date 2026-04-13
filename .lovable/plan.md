

# Plano: Corrigir stage padrão para "Novo Lead" nos endpoints e edge functions

## Diagnóstico

Os 3 webhook endpoints da PIPELINE INSIDE SALES já possuem `stage_id` explícito:
- **Bio Instagram** → Lead Instagram (intencional)
- **Lead_form_50k** → Lead Gratuito (intencional)
- **Lead Live Campanha Janeiro** → Lead Gratuito (inativo)

Nenhum desses aponta para "ANAMNESE INCOMPLETA". **O problema real está nas edge functions** que criam deals diretamente na Inside Sales usando fallback `ORDER BY stage_order ASC LIMIT 1`, que pega "ANAMNESE INCOMPLETA" (stage_order=0) em vez de "Novo Lead" (stage_order=3).

### Funções afetadas:

| Função | Comportamento atual | Problema |
|--------|-------------------|----------|
| `hubla-webhook-handler` (linha 505) | `order('stage_order', asc).limit(1)` | Pega ANAMNESE INCOMPLETA |
| `webhook-lead-receiver` (linha 418) | `order('stage_order', asc).limit(1)` (redirect A010) | Pega ANAMNESE INCOMPLETA |
| `webhook-lead-receiver` (linha 124-150) | Fallback quando endpoint sem stage_id | Pega ANAMNESE INCOMPLETA |
| `webhook-make-a010` (linha 429) | `ilike('stage_name', '%Novo Lead%')` | **OK - já busca por nome** |

## Alterações

### 1. `hubla-webhook-handler/index.ts` (~linha 505)
Substituir o fallback genérico por busca explícita pelo nome "Novo Lead":
```typescript
// DE: order('stage_order', { ascending: true }).limit(1)
// PARA:
.ilike('stage_name', '%Novo Lead%').limit(1).maybeSingle();
// Com fallback para stage_order se não encontrar
```

### 2. `webhook-lead-receiver/index.ts` (~linha 418-426)
Mesmo ajuste no trecho que redireciona compradores A010 para Inside Sales:
```typescript
// Buscar stage "Novo Lead" por nome em vez de primeira stage
.ilike('stage_name', '%Novo Lead%').limit(1).maybeSingle();
```

### 3. `webhook-lead-receiver/index.ts` (~linha 123-151)
Ajustar o fallback genérico para preferir "Novo Lead" por nome antes de usar stage_order:
```typescript
// Primeiro tentar por nome "Novo Lead", depois fallback stage_order
```

### 4. Deploy das 2 edge functions
- `webhook-lead-receiver`
- `hubla-webhook-handler`

## Resultado
Todos os novos leads cairão em "Novo Lead" (stage_id: `cf4a369c-c4a6-4299-933d-5ae3dcc39d4b`) em vez de "ANAMNESE INCOMPLETA", independente da ordem dos stages na pipeline.

