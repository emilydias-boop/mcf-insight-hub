## 🔍 Diagnóstico

A movimentação automática **existe**, mas está **quebrada há dias**. Investigação:

### 1. Cron job está agendado e ativo
- **Job**: `move-partners-to-venda-realizada`
- **Schedule**: `0 */6 * * *` (a cada 6 horas)
- **Status**: `active = true`

### 2. Mas TODAS as execuções falham
Últimas 5 execuções (incluindo a de hoje 27/04 00:00):
```
status: failed
return_message: ERROR: unrecognized configuration parameter "supabase.service_role_key"
```

### 3. Causa raiz
O cron foi criado usando `current_setting('supabase.service_role_key')`, que **não é uma configuração válida do Postgres**. O cron tenta chamar a edge function via `net.http_post`, falha ao montar o header `Authorization`, e nunca dispara a função. Por isso o Filipe (e qualquer outro parceiro recente) nunca foi movido automaticamente.

### 4. Bug secundário (já discutido)
Mesmo se o cron rodasse, a função `move-partners-to-venda-realizada` protege qualquer deal com reunião em **qualquer status diferente de `cancelled`** — incluindo `completed`. Isso significa que o Filipe (R1 realizada) seria pulado todo dia como `skipped_with_meetings`.

---

## 🛠️ Plano de Correção

### Passo 1 — Recriar o cron job com autenticação correta (migration)
Substituir o cron quebrado por uma versão que usa o **anon key** diretamente no header `Authorization` (a edge function tem `verify_jwt = false` e usa o `SUPABASE_SERVICE_ROLE_KEY` internamente via `Deno.env`):

```sql
SELECT cron.unschedule('move-partners-to-venda-realizada');

SELECT cron.schedule(
  'move-partners-to-venda-realizada',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/move-partners-to-venda-realizada',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' -- anon key
    ),
    body := '{"dry_run": false}'::jsonb
  );
  $$
);
```

### Passo 2 — Refinar a proteção de reuniões em `move-partners-to-venda-realizada/index.ts`

Atualizar o filtro `dealsWithMeetings` para **só proteger deals com reuniões realmente ativas/futuras**:

- ✅ **Bloquear movimentação** se houver attendee em: `scheduled`, `pre_scheduled`, `confirmed`, `rescheduled` **E** `scheduled_at > now()`
- ✅ **Permitir movimentação** se reunião estiver em: `completed`, `realized`, `no_show`, `cancelled` (são estados terminais — não justificam manter parceiro fora de Venda Realizada)

```ts
const { data: attendees } = await supabase
  .from('meeting_slot_attendees')
  .select('deal_id, status, meeting_slot:meeting_slots!inner(scheduled_at)')
  .in('deal_id', batch)
  .in('status', ['scheduled', 'pre_scheduled', 'confirmed', 'rescheduled'])
  .gt('meeting_slot.scheduled_at', new Date().toISOString());
```

### Passo 3 — Disparo imediato pós-deploy
Após a correção, chamar a função uma vez manualmente (`dry_run: false`) para limpar o backlog acumulado (Filipe + outros). Isso vai:
- Mover todos os parceiros pendentes para Venda Realizada
- Adicionar a tag "Parceiro"
- Registrar `deal_activities` para auditoria

### Passo 4 — Verificação
Consultar `cron.job_run_details` em ~6h para confirmar `status = 'succeeded'` na próxima execução agendada.

---

## 📦 Arquivos afetados
- **Nova migration SQL** (recriar cron com header válido)
- `supabase/functions/move-partners-to-venda-realizada/index.ts` (refinar proteção)
- Disparo manual via curl pós-deploy

## ✅ Resultado esperado
- Cron rodando com sucesso a cada 6h
- Parceiros (incluindo casos como Filipe com R1 realizada) sendo movidos automaticamente sem intervenção manual
- Botão "Mover Parceiros" continua disponível como ferramenta de inspeção/forçar execução pontual