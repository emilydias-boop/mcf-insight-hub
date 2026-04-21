

## Bug: Agendamentos do dia somem quando a reunião está marcada para o futuro

### Diagnóstico (caso Herbert / Carol Correa, 21/04/2026)

| Item | Valor |
|---|---|
| Lead | Herbert Viana Cavalcanti da Silva |
| Attendee criado em | 21/04/2026 12:00 (hoje) |
| `booked_by` | Carol Correa ✅ |
| Reunião marcada para (`scheduled_at`) | **22/04/2026 17:45** (amanhã) |
| Status | `invited` |

A Carol agendou **hoje** uma R1 para **amanhã**. No filtro "Hoje", o agendamento dela deveria contar +1 — mas aparece **0**.

### Causa raiz na RPC `get_sdr_metrics_from_agenda` (versão com `bu_filter`)

A RPC tem três CTEs:

1. **`dedup_agendada`** — filtra `meeting_day BETWEEN start AND end` (data da reunião dentro do período)
2. **`agendamentos_cte`** — filtra `effective_booked_at BETWEEN start AND end` (data do agendamento dentro do período)
3. **`sdr_stats`** — faz `FROM dedup_agendada d LEFT JOIN agendamentos_cte a ...`

**O problema:** `sdr_stats` parte de `dedup_agendada`. Se o SDR não tiver nenhuma reunião acontecendo no período (caso da Carol hoje, que só tem reunião amanhã), ele é eliminado já na CTE base, e o `agendamentos_cte` (onde ele aparece corretamente) é descartado pelo LEFT JOIN inverso.

Resultado: **agendamentos de hoje para o futuro nunca contam no card "Agendamento" do dia em que foram feitos.** Esse bug afeta toda a equipe, não só a Carol.

### Correção

Reescrever a CTE final (`sdr_stats`) para usar **UNION** dos SDRs presentes em `dedup_agendada`, `agendamentos_cte` e `contratos_cte`, em vez de basear tudo em `dedup_agendada`:

```sql
sdr_universe AS (
  SELECT sdr_email, sdr_name FROM dedup_agendada
  UNION
  SELECT sdr_email, sdr_email FROM agendamentos_cte 
    JOIN raw_attendees USING (sdr_email)  -- pra recuperar sdr_name
  UNION
  SELECT sdr_email, sdr_email FROM contratos_cte ...
),
sdr_stats AS (
  SELECT u.sdr_email, u.sdr_name,
    COALESCE(a.agendamentos, 0) as agendamentos,
    COALESCE(SUM(d.agendada_count), 0)::int as r1_agendada,
    COALESCE(SUM(d.realized), 0)::int as r1_realizada,
    COALESCE(SUM(d.is_noshow), 0)::int as no_shows,
    COALESCE(c.contratos, 0) as contratos
  FROM sdr_universe u
  LEFT JOIN dedup_agendada d ON d.sdr_email = u.sdr_email
  LEFT JOIN agendamentos_cte a ON a.sdr_email = u.sdr_email
  LEFT JOIN contratos_cte c ON c.sdr_email = u.sdr_email
  GROUP BY u.sdr_email, u.sdr_name, a.agendamentos, c.contratos
)
```

Forma mais limpa: derivar `sdr_universe` direto de `raw_attendees` filtrando por **qualquer** uma das três condições (meeting_day OR booked_at OR contract_paid_at no período).

### Impacto esperado

Após a correção, no filtro "Hoje" (21/04):
- **Carol Correa**: Agendamento passa de 0 → **1** (Herbert)
- Qualquer outro SDR que agendou hoje uma R1 para 22/04 ou depois também terá seus agendamentos contados
- Card de KPI **"AGENDAMENTOS"** no topo subirá proporcionalmente
- R1 Agendada / R1 Realizada / Contratos não mudam (já filtravam por scheduled_at, que continua igual)

### Arquivo afetado

- Nova migration SQL substituindo `public.get_sdr_metrics_from_agenda(text, text, text, text)` (a versão com `bu_filter`). A versão sem `bu_filter` (assinatura antiga) já faz o cálculo certo via GROUP BY simples e não precisa mudar.

### Validação pós-fix

1. Rodar `SELECT get_sdr_metrics_from_agenda('2026-04-21','2026-04-21','carol.correa@minhacasafinanciada.com','incorporador');` → esperar `agendamentos: 1`
2. Rodar sem filtro de SDR → conferir que o total de agendamentos do time hoje aumenta
3. Refrescar `/crm/reunioes-equipe?preset=today` → Carol Correa com 1 agendamento, KPI atualizado

