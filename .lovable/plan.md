

## Limpeza final — 2 itens para remover

### Decisões
1. **`notify-new-lead/`** — MANTER (função oculta por hora, será usada futuramente)
2. **`auto-close-weekly-metrics/`** — DELETAR (página associada já foi excluída)
3. **`bulk-transfer-by-name/`** — DELETAR (redundante com `useBulkTransfer.ts` e `useTransferDealOwner` no frontend)

### Também corrigir
4. **`detect-ghost-appointments`** no `config.toml` — entrada fantasma (pasta já não existe)
5. **`useDuplicateContactsLegacy()`** em `useDuplicateContacts.ts` — export morto, nunca importado
6. **`bulk-update-contacts/`** — edge function sem referência, DELETAR

### Ações

| Ação | Arquivo |
|------|---------|
| Deletar pasta | `supabase/functions/auto-close-weekly-metrics/` |
| Deletar pasta | `supabase/functions/bulk-transfer-by-name/` |
| Deletar pasta | `supabase/functions/bulk-update-contacts/` |
| Remover do config.toml | Entradas: `auto-close-weekly-metrics`, `bulk-transfer-by-name`, `bulk-update-contacts`, `detect-ghost-appointments` |
| Editar `useDuplicateContacts.ts` | Remover export `useDuplicateContactsLegacy()` (~50 linhas mortas) |

### O que permanece
- `notify-new-lead/` — mantido conforme solicitado
- Todos os módulos ativos — zero impacto

