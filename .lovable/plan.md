

## Plano: Corrigir duplicação de contatos nos webhooks e syncs — ✅ CONCLUÍDO

### Correções implementadas

#### Lógica padrão de deduplicação (aplicada em todas as funções):
1. Buscar por email (ilike)
2. Se não encontrou → buscar por telefone normalizado (últimos 9 dígitos)
3. Se encontrou → usar existente e atualizar campos faltantes (email, phone)
4. Se não encontrou → criar novo contato

#### Funções corrigidas:
1. ✅ `clint-webhook-handler/index.ts` — `handleContactCreated`: Adicionado fallback por telefone
2. ✅ `clint-webhook-handler/index.ts` — `handleDealCreated`: Adicionado fallback por telefone + enriquecimento de email
3. ✅ `clint-webhook-handler/index.ts` — `handleDealStageChanged`: Refatorado para buscar por email → telefone → criar
4. ✅ `webhook-live-leads/index.ts`: Adicionado fallback por telefone + enriquecimento de email
5. ✅ `webhook-lead-receiver/index.ts`: Adicionado fallback por telefone + enriquecimento de email
6. ✅ `sync-contacts/index.ts`: Adicionada reconciliação de clint_id antes do upsert (evita duplicação cross-source)

### Próximo passo: Limpar duplicados existentes
- Executar `merge-duplicate-contacts` com `dry_run: true` para verificar
- Depois com `dry_run: false` para unificar os registros já duplicados
