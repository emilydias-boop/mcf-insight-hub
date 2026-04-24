## Problema

A página **"Minhas Reuniões"** (`/sdr/minhas-reunioes`) e o **"Painel da Equipe"** mostram números diferentes para o mesmo SDR (ex: Carol Correa) porque chamam **versões distintas** da mesma função RPC:

| Versão | Usada por | Lógica |
|---|---|---|
| `get_sdr_metrics_from_agenda(3 args)` | `useMinhasReunioesFromAgenda` (página individual) | **LEGADA** — conta cada attendee sem deduplicar por `deal_id`, ignora `sdr_squad_history`. Infla números de Agendamentos e Contratos. |
| `get_sdr_metrics_from_agenda(4 args)` | `useTeamMeetingsData` (painel da equipe) | **MODERNA** — deduplica por `deal_id`, usa `ROW_NUMBER() <= 2`, respeita histórico de squad. |

O mesmo problema existe em `get_sdr_meetings_from_agenda` (3 args vs 4 args).

## Solução: Opção B — Unificar no banco

### 1. Migration: remover funções legadas (3 args)

```sql
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);
DROP FUNCTION IF EXISTS public.get_sdr_meetings_from_agenda(text, text, text);
```

A versão de 4 argumentos já tem `bu_filter text DEFAULT NULL`, então chamadas com 3 args quebrariam por ambiguidade. Após o DROP, o PostgREST resolverá automaticamente para a versão de 4 args usando `bu_filter = NULL`.

### 2. Frontend: garantir que chamadas de 3 args sejam compatíveis

Os hooks `useSdrMetricsFromAgenda` e `useSdrMeetingsFromAgenda` **já passam `bu_filter: buFilter || null`** (4 args sempre). Verificar se há outros consumidores chamando só com 3 args:

- `useMinhasReunioesFromAgenda` → chama `useSdrMetricsFromAgenda(startDate, endDate, sdrEmail)` (3 args) → o hook internamente envia `bu_filter: null` para a RPC ✅
- `useSdrMeetingsFromAgenda` → idem ✅

Nenhuma alteração de código frontend é necessária. A própria RPC de 4 args trata `bu_filter = NULL` retornando todos os squads.

### 3. Resultado esperado

Após o DROP:
- "Minhas Reuniões" da Carol passará a usar a lógica deduplicada (mesmos números do painel da equipe).
- Agendamentos: contados por `deal_id` distinto com `ordem <= 2` (1º agendamento + 1 reagendamento válido).
- Contratos: `COUNT(DISTINCT deal_id)` ao invés de contar cada attendee.
- Squad histórico respeitado via `sdr_squad_history`.

### 4. Validação pós-deploy

Comparar os números da Carol (e 2-3 outros SDRs) entre as duas telas — devem ser **idênticos**.

## Riscos

- **Baixo**: a versão de 4 args é estritamente mais correta; a versão antiga já era considerada bugada.
- Se algum outro consumidor (não identificado) depende explicitamente da contagem inflada, ele verá uma redução nos números — o que é o comportamento desejado.

## Arquivos afetados

- **Nova migration**: `DROP` das duas funções legadas de 3 argumentos.
- **Nenhum código frontend** precisa mudar.
