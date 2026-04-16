

## Unificação da lógica de Aprovados R2 — Fonte única via RPC

### Diagnóstico

Atualmente existem **5 hooks diferentes** calculando "aprovados" com lógicas divergentes:
- `useR2CarrinhoKPIs` (Carrinho KPI cards) → 29
- `useR2CarrinhoData` (Carrinho aba Aprovados) → 29
- `useR2MetricsData` (Carrinho Métricas) → usa contratos como base
- `useContractLifecycleReport` (Agenda R2 Relatório) → 32
- `useCloserCarrinhoMetrics` (breakdown por closer) → lógica própria

Os 3 extras vêm de:
1. **Leads da semana anterior** (Gustavo Lourenço R2 10/04, Jaziel Alencar R2 09/04, Uislaine Fuzzo R2 10/04, Wilde Oliveira R2 14/04) — seus R2 caem dentro da janela operacional Fri-Fri mas pertencem ao carrinho anterior. O campo `carrinho_week_start` está NULL neles, então o filtro `if (r2WeekStart && r2WeekStart !== cartWeekStartStr) continue` não os exclui (só filtra quando o campo está preenchido E é diferente).
2. **Duplicatas** (Joyce Maria, Luiz Carlos) — mesma pessoa com 2 registros R1 diferentes (`deal_id` distintos), e a deduplicação por `deal_id` não detecta.
3. **Faltando** (Daniel Marotti, Fabio Carneiro, Márcio Barros) — provavelmente sem contrato A000 na safra (são "outside" ou sem R1 match).

### Solução: RPC SQL centralizada

Criar uma função SQL `get_carrinho_week_leads` que retorna TODOS os dados de um carrinho em uma única query, com deduplicação por telefone (9 dígitos) e filtragem correta de semana.

#### 1. Migration SQL — `get_carrinho_week_leads(p_week_start DATE)`

```text
Parâmetros: p_week_start (Quinta), p_friday_cutoff TIMESTAMPTZ, p_prev_friday_cutoff TIMESTAMPTZ

Lógica:
1. Buscar TODOS os meeting_slot_attendees R2 onde:
   - scheduled_at BETWEEN p_prev_friday_cutoff AND p_friday_cutoff
   - OU carrinho_week_start = p_week_start
   - status != 'cancelled'
2. Deduplicar por RIGHT(digits_only(phone), 9) — manter o mais recente
3. Retornar: attendee_id, name, phone, email, r2_status, 
   r2_closer, r2_date, r1_closer, r1_date, contract_paid_at, 
   carrinho_status, deal_id, is_encaixado
```

A função faz JOINs internos para R1 e contratos (hubla_transactions), eliminando as ~10 queries sequenciais do frontend.

#### 2. Novo hook centralizado — `useCarrinhoUnifiedData`

- Chama `supabase.rpc('get_carrinho_week_leads', { p_week_start, p_friday_cutoff, p_prev_friday_cutoff })`
- Retorna `CarrinhoLeadRow[]` com todos os campos necessários
- Filtragem por r2_status (aprovado, pendente, fora, etc.) é feita no cliente sobre os dados retornados
- Um único `queryKey` invalidado em todos os lugares

#### 3. Refatorar consumidores

| Arquivo | Mudança |
|---------|---------|
| `useR2CarrinhoKPIs.ts` | Substituir lógica por contagem sobre `useCarrinhoUnifiedData` |
| `useR2CarrinhoData.ts` | Substituir queries por filtro sobre dados unificados |
| `useR2MetricsData.ts` | Usar mesma base de leads para contadores |
| `useContractLifecycleReport.ts` | Usar mesma base de leads (maior refactor) |
| `useCloserCarrinhoMetrics.ts` | Derivar de dados unificados |
| `useR2ForaDoCarrinhoData.ts` | Filtrar do mesmo dataset |
| `R2Carrinho.tsx` | Ajustar para usar novo hook |
| `R2ContractLifecyclePanel.tsx` | Ajustar para usar novo hook |
| `R2MetricsPanel.tsx` | Ajustar prop de aprovados |
| `R2AprovadosList.tsx` | Sem mudança (já recebe dados prontos) |

#### 4. Correções específicas

- **Deduplicação por telefone**: A RPC agrupa por `RIGHT(regexp_replace(phone, '\D', '', 'g'), 9)` e mantém apenas o registro com o R2 `scheduled_at` mais recente, eliminando duplicatas como Joyce Maria e Luiz Carlos.
- **Filtro de semana estrito**: Se `carrinho_week_start IS NOT NULL` e diferente da semana atual → EXCLUIR. Se `carrinho_week_start IS NULL` e `scheduled_at` cai na janela → INCLUIR (pertence a esta semana por padrão). Isso corrige leads da semana anterior que não tinham o campo preenchido.
- **Leads outside/sem R1**: A RPC inclui leads cujo R2 está na janela mesmo sem contrato A000, resolvendo Daniel Marotti, Fabio Carneiro e Márcio Barros.

### Benefícios

- **Uma fonte de verdade**: Todos os contadores batem entre si
- **Performance**: 1 query RPC vs 10-15 queries sequenciais
- **Deduplicação robusta**: Por telefone, não por `deal_id`
- **Manutenibilidade**: Mudança de regra em um lugar só

### Arquivos alterados

- 1 migration SQL (RPC function)
- 1 novo hook (`useCarrinhoUnifiedData.ts`)
- 6-8 hooks refatorados para consumir dados unificados
- 2-3 componentes ajustados

