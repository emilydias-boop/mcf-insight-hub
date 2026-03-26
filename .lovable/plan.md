

## Remover Jessica Martins dos SDRs + Eliminar listas hardcoded desnecessárias

### Problema
Existem **3 listas hardcoded** de SDRs que precisam de manutenção manual toda vez que alguém entra/sai:

1. **`SDR_LIST`** em `src/constants/team.ts` — usada por `useSdrDetailData` e `useSalesCelebration`
2. **`SDR_CONFIG`** em `supabase/functions/distribute-leads-list/index.ts` — edge function de distribuição com lista fixa de 8 SDRs + 200 emails de leads
3. **Tabela `sdr`** no banco — fonte dinâmica já usada por `useSdrsFromSquad`

O sistema já tem `useSdrsFromSquad` que consulta o banco dinamicamente. As listas hardcoded são redundantes e causam exatamente esse problema: Jessica Martins saiu de SDR para Closer R2 mas continua aparecendo porque ninguém atualizou as constantes.

### Ações

| # | Ação | Arquivo |
|---|------|---------|
| 1 | **Remover Jessica Martins do `SDR_LIST`** | `src/constants/team.ts` (linha 7) |
| 2 | **Remover Jessica Martins do `SDR_CONFIG`** | `supabase/functions/distribute-leads-list/index.ts` (linha 17) |
| 3 | **Refatorar `useSdrDetailData`** para buscar info do SDR via banco (`useSdrsFromSquad`) em vez de `SDR_LIST` | `src/hooks/useSdrDetailData.ts` |
| 4 | **Refatorar `useSalesCelebration`** para buscar SDRs do banco em vez de validar contra `SDR_LIST` hardcoded | `src/hooks/useSalesCelebration.ts` |
| 5 | **Atualizar banco** — setar `active = false` para Jessica Martins na tabela `sdr` | SQL UPDATE via insert tool |

### Resultado
- `SDR_LIST` deixa de ser a fonte de verdade — o banco é a única fonte
- Quando alguém entra/sai, basta atualizar a tabela `sdr` no banco (ou via tela de admin)
- A edge function `distribute-leads-list` ainda mantém `SDR_CONFIG` hardcoded porque é uma function serverless sem acesso ao hook — mas Jessica sai dela

### Detalhe técnico

**`useSdrDetailData`** (linhas 50-60): trocar de:
```ts
const sdrFromList = SDR_LIST.find(...)
```
Para consultar a tabela `sdr` diretamente via query inline ou reusar `useSdrsFromSquad`.

**`useSalesCelebration`** (linhas 246, 268, 297): trocar validação `SDR_LIST.some(...)` por consulta ao banco (fetch SDRs ativos uma vez e cachear).

**`distribute-leads-list`**: como é edge function serverless, a opção é consultar a tabela `sdr` dinamicamente em vez do array hardcoded — mas como primeiro passo, apenas remover Jessica.

