

## Problema: Métricas de Ligações mostrando números errados

### Diagnóstico

Existem **2 problemas** no hook `useSdrActivityMetrics`:

**1. Limite de 1000 linhas do Supabase (CRÍTICO)**

O Supabase JS client retorna no máximo 1000 linhas por padrão. Em Março 2026 existem **3.470 ligações**, mas o hook só recebe as primeiras 1000. Isso corta ~71% dos dados. O mesmo acontece com `deal_activities`.

A query atual:
```js
const { data: calls } = await supabase
  .from('calls')
  .select('user_id, status, outcome, deal_id')
  .gte('created_at', startIso)
  .lte('created_at', endIso);
// Retorna apenas 1000 de 3470!
```

**2. Sem filtro de `direction = 'outbound'`**

O hook conta todas as ligações (inbound + outbound), enquanto o padrão correto do sistema (usado em `useSdrCallMetrics` e `sync-sdr-kpis`) é contar apenas `outbound`.

### Correção

**`src/hooks/useSdrActivityMetrics.ts`**:

1. Adicionar filtro `.eq('direction', 'outbound')` na query de calls
2. Usar paginação para buscar todas as linhas (loop com `.range()` em batches de 1000) tanto para `calls` quanto para `deal_activities`

A função de paginação será algo como:
```ts
async function fetchAll(query) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data } = await query.range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
```

Isso garante que todas as 3.470+ ligações sejam contadas, e apenas as outbound (realizadas pelo SDR).

### Resultado esperado

- Antes: ~1000 ligações truncadas, sem filtro de direção
- Depois: Todas as 3.470 ligações outbound contadas corretamente por SDR

