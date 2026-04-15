

## Plano: Corrigir cálculo de No-Show para excluir Pendentes

### Problema
A RPC `get_sdr_metrics_from_agenda` calcula no-shows como `r1_agendada - r1_realizada`, o que inclui reuniões ainda pendentes (`invited`/`scheduled`) como no-show. Isso infla artificialmente o número e a taxa de no-show.

**Dados de hoje (15/04):**
- `invited` (pendentes): 23
- `no_show` (real): 24
- Atual: No-Shows = 41 (pendentes + no-shows reais misturados)
- Correto: No-Shows = 24 (apenas status `no_show`)

### Correção

**Arquivo: RPC `get_sdr_metrics_from_agenda`** (migração SQL)

Na versão com deduplicação (segunda definição da function, que é a usada com `bu_filter`):

1. No CTE `dedup_agendada`, adicionar contagem de no-shows reais:
```sql
MAX(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as is_noshow
```

2. No CTE `sdr_stats`, somar no-shows reais:
```sql
SUM(d.is_noshow)::int as no_shows
```

3. No JSON final, usar `no_shows` diretamente em vez de `GREATEST(0, r1_agendada - r1_realizada)`:
```sql
'no_shows', no_shows
```

A mesma correção se aplica à primeira versão da function (sem `bu_filter`), que usa a fórmula idêntica na linha 55.

### Resultado esperado
- No-Shows: **~24** (apenas reuniões com status `no_show`)
- Pendentes (23) deixam de ser contados como no-show
- Taxa No-Show cai de 63.1% para ~37% (24/65), refletindo a realidade

### Seção técnica
- Migração SQL para recriar a function `get_sdr_metrics_from_agenda` com ambas as assinaturas
- Nenhuma alteração em código TypeScript — o campo `no_shows` já é consumido corretamente pelo frontend

