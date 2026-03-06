
## Problema: Janela de 30h ao invés de 24h para filtro de contratos BRT

### Causa raiz

A correção de fuso anterior aplicou `subHours` no `start` e `addHours` no `end`, criando uma janela de **30 horas** em vez de 24. O correto é **somar** 3h em AMBOS os extremos (converter meia-noite BRT para UTC).

```text
ERRADO (atual):
  start = 04/03 00:00 - 3h = 03/03 21:00 UTC  ← captura contratos do dia anterior!
  end   = 04/03 23:59 + 3h = 05/03 02:59 UTC
  Janela = 30h

CORRETO:
  start = 04/03 00:00 + 3h = 04/03 03:00 UTC  ← meia-noite BRT exata
  end   = 04/03 23:59 + 3h = 05/03 02:59 UTC
  Janela = 24h
```

Os contratos do dia 03/03 BRT (pagos entre 03/03 21:00–23:59 UTC) estão sendo incluídos incorretamente na contagem do dia 04/03.

### Arquivos a alterar

**1. `src/hooks/useContractReport.ts` — linha 46**

```ts
// DE (errado):
const startISO = subHours(new Date(...'T00:00:00'), BRT_OFFSET_HOURS).toISOString();

// PARA (correto):
const startISO = addHours(new Date(...'T00:00:00'), BRT_OFFSET_HOURS).toISOString();
```

**2. `src/hooks/useR1CloserMetrics.ts` — linha 48**

```ts
// DE (errado):
const start = subHours(startOfDay(startDate), BRT_OFFSET_HOURS).toISOString();

// PARA (correto):
const start = addHours(startOfDay(startDate), BRT_OFFSET_HOURS).toISOString();
```

Ambas as correções removem o `subHours` do `start` e usam `addHours` (mesmo padrão do `end`), garantindo que o filtro captura exatamente as 24h do dia em BRT convertidas para UTC.
