

## Fix: drop overload duplicada da RPC `get_carrinho_r2_attendees`

### Diagnóstico (causa raiz confirmada via network logs)

A migration anterior tentou estender a RPC com novo parâmetro `p_apply_contract_cutoff`, mas o Postgres criou uma **função NOVA em vez de substituir** — porque adicionar um parâmetro muda a assinatura. Resultado: **2 versões coexistem** no banco:

```
get_carrinho_r2_attendees(p_week_start, p_window_start, p_window_end)               -- ANTIGA
get_carrinho_r2_attendees(p_week_start, p_window_start, p_window_end, p_apply_…)    -- NOVA
```

PostgREST recebe a chamada do `useContractLifecycleReport` (3 args) e responde:
```
PGRST203 — Could not choose the best candidate function
```
Status HTTP **300** = ambíguo. Todos os hooks que ainda chamam com 3 args quebram → painel zera.

Por isso **só o painel "Relatório" zerou**: o `R2MetricsPanel` (Carrinho R2) já passa o 4º argumento, então funciona. O `useContractLifecycleReport` (esta tela) ainda chama com 3 args.

### Fix em 2 linhas

**1. Migração SQL — DROP da função antiga**
```sql
DROP FUNCTION IF EXISTS public.get_carrinho_r2_attendees(date, timestamptz, timestamptz);
```
Mantém apenas a versão de 4 args (que tem default `false` no `p_apply_contract_cutoff`, retro-compatível).

**2. `src/hooks/useContractLifecycleReport.ts` (linha 126)**
- Passar explicitamente `p_apply_contract_cutoff: false` para evitar futura ambiguidade caso alguém recrie overload.

### Validação esperada

- Painel "Relatório" volta a popular: 129 contratos Hubla + 85 R2s = ~120 leads únicos esperados.
- `R2MetricsPanel` (Carrinho R2) continua funcionando como está.
- Nenhuma quebra: a versão de 4 args já existe e tem `DEFAULT false`.

### Arquivos

- Nova migração SQL (DROP da função antiga de 3 args)
- `src/hooks/useContractLifecycleReport.ts` (passar 4º arg explícito)

