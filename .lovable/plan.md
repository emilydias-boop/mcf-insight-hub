

## Varredura final — 4 edge functions órfãs restantes

Após verificar **todas as 87 edge functions** contra o frontend (src/) e contra chamadas cruzadas entre functions, o sistema está quase 100% limpo. Restam apenas **4 edge functions sem nenhum consumidor**:

### Edge functions confirmadas como órfãs

| Função | Linhas | Referências no frontend | Referências em outras functions | Veredicto |
|--------|--------|------------------------|--------------------------------|-----------|
| `reprocess-hubla-events/` | ~200 | 0 | 0 | DELETAR |
| `reprocess-hubla-webhooks/` | ~180 | 0 | 0 | DELETAR |
| `reprocess-contract-payments/` | ~150 | 0 | 0 | DELETAR |
| `process-csv-imports/` | 721 | 0 | 0 | DELETAR — o frontend usa `import-contacts-csv` e `import-deals-csv` diretamente |

### O que NÃO é órfão (confirmado ativo)

- `reprocess-failed-webhooks/` — chamado por `sync-clint-data` e `reprocess-failed-webhooks-cron`
- `sync-newsale-orphans/` — chamado por `sync-newsale-orphans-cron`
- Todos os hooks verificados (`useLinkTransactionToAttendee`, `useLinkContractToAttendee`, `useNewLeadNotifications`, etc.) — todos importados por componentes ativos

### Ações

| Ação | Arquivo |
|------|---------|
| Deletar pasta | `supabase/functions/reprocess-hubla-events/` |
| Deletar pasta | `supabase/functions/reprocess-hubla-webhooks/` |
| Deletar pasta | `supabase/functions/reprocess-contract-payments/` |
| Deletar pasta | `supabase/functions/process-csv-imports/` |
| Editar | `supabase/config.toml` — remover as 4 entradas correspondentes |

### Impacto
Zero. Nenhum módulo ativo, nenhum cron job e nenhuma outra edge function referencia essas 4 funções.

