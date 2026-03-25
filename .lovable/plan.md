

## Limpeza final — 3 hooks órfãos + 2 edge functions + fix config.toml

### Arquivos a deletar (5)
1. `src/hooks/useDuplicateActivities.ts` — 0 importadores
2. `src/hooks/useCheckActiveMeeting.ts` — 0 importadores
3. `src/hooks/useDirectorKPIs.ts` — referenciado apenas em comentários, não importado
4. `supabase/functions/distribute-leads-batch/index.ts` — sem referência
5. `supabase/functions/reprocess-mcfpay-skipped/index.ts` — sem referência

### Arquivos a editar (1)
**`supabase/config.toml`** — adicionar entrada para `admin-send-reset`:
```toml
[functions.admin-send-reset]
verify_jwt = false
```

### Edições cosméticas em comentários (2)
- `src/hooks/useUltrameta.ts` linha 58: remover menção a `useDirectorKPIs` do comentário
- `src/lib/transactionHelpers.ts` linha 2: remover menção a `useDirectorKPIs` do comentário

### Impacto: zero
Nenhum módulo ativo importa esses arquivos. A adição do `admin-send-reset` ao config corrige uma lacuna existente.

