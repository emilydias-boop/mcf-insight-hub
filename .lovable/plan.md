

## Plano: Filtrar R1 Agendada por BU na RPC

### Problema

A RPC `get_sdr_metrics_from_agenda` retorna R1 de **todas as BUs** (incorporador + consorcio). Hoje existem:
- **44 attendees** em closers da BU incorporador (Mateus=15, Thayna=11, Cristiane=10, Julio=8)
- **16 attendees** em closers da BU consorcio (Joao Pedro=9, Victoria=6, Thobson=1)
- **Total: 60** (não 63 — a diferença anterior pode ter sido de attendees cancelados/rescheduled)

A "Metas da Equipe" mostra 63 porque soma tudo sem filtrar por BU. A agenda mostra 44 corretamente porque filtra por closers da BU incorporador.

### Solução

A RPC precisa filtrar pelo `closer.bu` para retornar apenas reuniões da BU correta.

| Componente | O que muda |
|-----------|-----------|
| Migration SQL | Adicionar parâmetro `bu_filter TEXT DEFAULT NULL` à RPC. Quando informado, faz JOIN com `closers` e filtra `WHERE closers.bu = bu_filter` |
| `src/hooks/useSdrMetricsFromAgenda.ts` | Passar o parâmetro `bu_filter` para a RPC (recebendo do squad) |
| `src/hooks/useTeamMeetingsData.ts` | Passar `squad` para `useSdrMetricsFromAgenda` |
| `src/hooks/useSdrMeetingsFromAgenda.ts` | Também filtrar por BU na RPC `get_sdr_meetings_from_agenda` (se aplicável) |

### SQL proposto

```sql
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL,
  bu_filter TEXT DEFAULT NULL
)
...
WHERE msa.status != 'cancelled'
  AND ms.meeting_type = 'r1'
  AND msa.is_partner = false
  AND (sdr_email_filter IS NULL OR p_booker.email = sdr_email_filter)
  AND (bu_filter IS NULL OR c.bu = bu_filter)  -- NEW
...
```

### Resultado
- Metas da Equipe (Incorporador) mostrará **44** R1 Agendada para hoje, consistente com a agenda
- Metas da Equipe (Consorcio) mostrará **16** separadamente
- Sem bu_filter, continua retornando tudo (backward compatible)

