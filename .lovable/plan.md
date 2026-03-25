

## Limpeza adicional — plano ajustado

### 1. `src/data/mockData.ts` — limpar ~220 linhas
Manter apenas o tipo `SemanaMes` (usado por `ResumoFinanceiro.tsx`). Deletar todos os arrays e tipos mock sem consumidor.

### 2. Dashboard — remover resquícios parciais

**`src/pages/Dashboard.tsx`:**
- Remover entradas `credito`, `projetos`, `leilao` do `SETOR_MODAL_CONFIG`

**`src/hooks/useSetoresDashboard.ts`:**
- Remover `projetos` e `leilao` do `SETOR_CONFIGS` e do tipo `SetorData.id`
- **MANTER `credito`** — usado pelo Painel de Equipe do Consórcio para metas

### 3. Edge Functions a deletar (6 pastas)
- `webhook-credito/` — órfã
- `backfill-a010-missing-deals/`
- `backfill-a010-offer-leads/`
- `backfill-construir-alugar/`
- `backfill-deal-activities/`
- `backfill-deal-owners/`

**NÃO deletar:** `backfill-orphan-owners/` (usado por `useOrphanDeals.ts`)

### 4. `supabase/config.toml`
Remover entradas das 6 funções deletadas acima.

### Resumo
- 6 pastas edge function deletadas
- 1 arquivo editado (mockData.ts — reduzido de ~276 linhas para ~15)
- 2 arquivos editados (Dashboard.tsx, useSetoresDashboard.ts — remover linhas mortas)
- 1 arquivo editado (config.toml)
- Zero impacto em módulos ativos

