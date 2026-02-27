

## Plano: Corrigir duplicação de contatos nos webhooks e syncs

### Problema
Contatos estão sendo duplicados porque cada fonte (Clint, Hubla, Live, webhook-receiver) gera um `clint_id` diferente para a mesma pessoa. A lógica atual em vários handlers só verifica email **ou** só usa `clint_id` como chave de upsert, criando registros duplicados.

### Funções afetadas e correções

#### 1. `clint-webhook-handler/index.ts` — `handleDealCreated` (linha ~596)
- **Atual**: Busca contato apenas por `.eq('email', ...)` — sem fallback por telefone
- **Corrigir**: Adicionar fallback por telefone normalizado (igual ao Hubla handler)

#### 2. `clint-webhook-handler/index.ts` — `handleDealStageChanged` (linha ~990)
- **Atual**: Busca contato por `.ilike('email', ...)`, se não encontra **cria novo** sem verificar telefone
- **Corrigir**: Antes de criar, verificar por telefone normalizado. Se encontrar, usar o existente e atualizar email faltante

#### 3. `clint-webhook-handler/index.ts` — `handleContactCreated` (linha ~407)
- **Atual**: Verifica email antes de criar, mas **não verifica telefone**
- **Corrigir**: Adicionar verificação por telefone antes de criar

#### 4. `webhook-live-leads/index.ts` (linha ~43)
- **Atual**: Busca apenas por email
- **Corrigir**: Adicionar fallback por telefone

#### 5. `webhook-lead-receiver/index.ts` (linha ~157)
- **Atual**: Busca apenas por email
- **Corrigir**: Adicionar fallback por telefone

#### 6. `sync-contacts/index.ts` (linha ~273)
- **Atual**: Upsert por `clint_id` — se o mesmo contato vem de outra fonte com outro `clint_id`, duplica
- **Corrigir**: Antes do upsert, verificar se já existe contato com mesmo email. Se existir, atualizar o `clint_id` do existente para evitar duplicação

### Lógica padrão de deduplicação (aplicar em todas)
```text
1. Buscar por email (ilike)
2. Se não encontrou → buscar por telefone normalizado (últimos 9 dígitos)
3. Se encontrou → usar existente e atualizar campos faltantes
4. Se não encontrou → criar novo contato
```

### Depois: Limpar duplicados existentes
- Executar `merge-duplicate-contacts` com `dry_run: false` para unificar os registros já duplicados no banco

