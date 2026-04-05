

# Refatorar useSDRCockpit para usar RPC `get_sdr_cockpit_queue`

## Resumo
Substituir a query manual do `useSDRQueue` pela chamada `supabase.rpc('get_sdr_cockpit_queue', ...)` e adaptar o mapeamento dos campos retornados pela RPC.

## Alteracoes

### `src/hooks/useSDRCockpit.ts`

**1. Reescrever `useSDRQueue`** (linhas 46-148):
- Remover toda a logica manual (query de stages, query de deals, query de activity counts, sorting)
- Substituir por `supabase.rpc('get_sdr_cockpit_queue', { p_owner_id: user.email, p_limit: limit, p_offset: offset })`
- Mapear campos retornados pela RPC para a interface `QueueDeal`:
  - `deal_id` → `id`
  - `contact_name` → `contactName` / `name`
  - `contact_phone` → `contactPhone`
  - `stage_name` → `stageName`
  - `stage_moved_at` → `stageMovedAt` + calcular `hoursInStage`
  - `next_action_date/type` → `nextActionDate/Type`
  - `activity_count` → `activityCount`
  - `call_attempts` → usado para flags
  - `urgency` → mapear para `isOverdue` (overdue), `isNew` (activity_count===0), `isStalledOver4h` (stale/urgent)
  - `priority_score` → ja vem ordenado, sem necessidade de sort local
- Campos que a RPC nao retorna (`contactEmail`, `nextActionNote`, `originName`, `originId`, `customFields`, `stageId`) serao `null` na fila — sao carregados no `useSelectedDeal` quando o lead e selecionado

**2. Atualizar interface `QueueDeal`** se necessario:
- Tornar opcionais campos nao retornados pela RPC (ou manter null)

**3. Remover constante `EXCLUDED_STAGE_NAMES`** — a RPC ja faz a filtragem

**4. `useSelectedDeal` permanece igual** — carrega dados completos do deal selecionado via queries diretas

### Nenhum outro arquivo alterado
Os componentes `CockpitQueue`, `CockpitExecutionPanel` e `CockpitQualificationPanel` consomem `QueueDeal` e `SelectedDealData` — como a interface se mantem compativel, nao precisam de mudancas.

