
## Causa raiz confirmada

O banco tem **duas versões conflitantes** da RPC, confirmado pela query:

```
args: start_date text, end_date text, sdr_email_filter text   ← versão antiga (funcionava)
args: start_date date, end_date date, sdr_email_filter text   ← criada em 20260317222312 (quebrou)
```

O `CREATE OR REPLACE FUNCTION` da migration de fix de no-show criou uma versão `date` sem dropar a versão `text` antiga. PostgREST recebe as duas como candidatas e retorna erro `PGRST203 (300 Multiple Functions Found)`.

A versão `text` era a que funcionava. A nova `date` tem as correções de no-show que queremos manter.

---

## Correção: 1 migration SQL

**Dropar a versão antiga `text`** — a versão `date` (com as correções de no-show) fica ativa e resolve o conflito:

```sql
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);
```

O frontend (`useSdrMetricsFromAgenda.ts`) envia strings `'yyyy-MM-dd'` que o PostgreSQL converte automaticamente para `date`, então a nova versão `date` funciona exatamente igual com a mesma chamada do frontend.

Nenhuma mudança de código TypeScript necessária.

---

## Impacto ao corrigir

- Dashboard "Reuniões Equipe" → agendamentos voltam a aparecer
- Página "Minhas Reuniões" → métricas individuais voltam
- Cards de SDR (useSdrAgendaMetricsBySdrId) → voltam a funcionar
- Relatório de Investigação (path SDR) → volta a funcionar

---

## Arquivo a criar

Nova migration SQL: `DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);`
