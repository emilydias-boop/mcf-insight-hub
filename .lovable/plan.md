## 🧹 Plano de Limpeza — Risco Zero

Verificação cruzada (`rg`) confirma que **nenhum dos itens abaixo é importado/referenciado** em qualquer lugar do código frontend ativo. A integração Clint foi oficialmente encerrada em 05/04/2026 (leads chegam via Hubla webhook direto).

---

### 🗑️ 1. Edge Functions Clint (9 funções, ~150KB)

Remover do filesystem **e** deletar do Supabase via `delete_edge_functions`:

- `supabase/functions/clint-api/`
- `supabase/functions/clint-webhook-handler/`
- `supabase/functions/sync-clint-data/`
- `supabase/functions/sync-contacts/`
- `supabase/functions/sync-deals/`
- `supabase/functions/sync-deals-from-agenda/` *(órfã no frontend)*
- `supabase/functions/sync-link-contacts/`
- `supabase/functions/sync-origins-stages/`
- `supabase/functions/sync-by-origin/`
- `supabase/functions/import-contacts-csv/` *(import CSV Clint, sem uso)*
- `supabase/functions/import-deals-csv/` *(import CSV Clint, sem uso)*

**Limpar 11 entradas correspondentes em `supabase/config.toml`.**

---

### 🗑️ 2. Componentes Clint órfãos

- `src/components/crm/SyncControls.tsx` *(card "Desativado")*
- `src/components/crm/SyncMonitor.tsx` *(monitor de jobs Clint)*
- `src/components/crm/CronJobSetup.tsx` *(card "Desativado")*

---

### 🗑️ 3. Hooks Clint órfãos

- `src/hooks/useClintFunnel.ts`
- `src/hooks/useClintFunnelByLeadType.ts`

⚠️ **Antes de deletar `useClintFunnelByLeadType.ts`**, vou reconfirmar que `FunilDuplo.tsx` (que o usa) também está órfão. Se `FunilDuplo` ainda for usado em algum dashboard, mantenho o hook.

---

### 🗑️ 4. Páginas placeholder vazias

- `src/pages/Index.tsx` *("Welcome to Your Blank App" — sem rota)*
- `src/pages/bu-consorcio/CRM.tsx` *(`return null` — sem rota)*

---

### ✅ O que NÃO será mexido

- Campo `clint_id` em `crm_contacts` (referência histórica, conforme memória).
- Tabelas `crm_origins`, `crm_stages`, `crm_groups`, `sync_jobs` (usadas por outras partes do CRM).
- `reprocess-failed-webhooks` (mantida — pode reprocessar webhooks Hubla).
- Hooks/componentes que **podem** estar sendo usados via dynamic import (Fase 2/3 — não incluído).

---

### 📋 Execução

1. Reconfirmar uso de `FunilDuplo.tsx` (decide se hook B fica/sai).
2. Deletar 11 pastas de edge functions + chamar `delete_edge_functions` com a lista.
3. Limpar `supabase/config.toml` removendo as 11 seções `[functions.<nome>]`.
4. Deletar 3 componentes + 1-2 hooks + 2 páginas.
5. Rodar build mental check (TypeScript) — nenhum import quebrado esperado pois já validamos via `rg`.

**Estimativa:** ~180KB de código removido, ~14 arquivos deletados, zero impacto funcional.
