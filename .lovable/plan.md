

## Plano: Sincronização automática de cobranças via cron job

### Problema
O botão "Sincronizar Hubla" exige ação manual. O usuário quer que as cobranças sejam atualizadas automaticamente.

### Solução
Criar um cron job no Supabase que chama a Edge Function `sync-billing-from-hubla` automaticamente a cada 30 minutos. Isso garante que parcelas pagas na Hubla sejam refletidas no billing sem intervenção humana.

### Implementação

**1. Migração SQL** — Criar cron job via `pg_cron` + `pg_net`:

```sql
SELECT cron.schedule(
  'sync-billing-from-hubla-auto',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/sync-billing-from-hubla',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
    body := '{"batchSize": 200}'::jsonb
  ) AS request_id;
  $$
);
```

Isso roda a cada 30 min, processa todas as transações parceladas e atualiza parcelas pagas.

**2. Manter o botão** — O botão "Sincronizar Hubla" continua existindo para reconciliação manual sob demanda, mas não é mais necessário no dia a dia.

### Notas
- O webhook da Hubla (já implementado) cuida dos pagamentos em tempo real
- O cron job serve como "rede de segurança" para reconciliar dados que o webhook pode ter perdido
- Frequência de 30 min é suficiente; pode ser ajustada depois

### Arquivo afetado

| Mudança | Tipo |
|---------|------|
| Migração SQL para criar cron job | SQL migration |

