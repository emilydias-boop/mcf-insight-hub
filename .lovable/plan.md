

# Corrigir deal duplicado do Kayo — vincular R1 ao deal da Juliana

## Situacao atual

O lead Kayo possui **2 deals** na mesma pipeline INSIDE SALES:

```text
Deal da Juliana (91dd2342) - "Novo Lead" - criado 13:58
Deal da Caroline (fe454fec) - "Reuniao 01 Agendada" - criado 13:49
```

A Juliana agendou a R1 com o closer Mateus Macedo, porem o meeting ficou vinculado ao deal da Caroline (o mais antigo). O deal da Juliana, que e o correto, permanece parado em "Novo Lead".

## Correcao necessaria (SQL)

Executar 3 comandos no SQL Editor do Supabase:

**1. Mover o meeting para o deal da Juliana:**

```sql
UPDATE meeting_slot_attendees
SET deal_id = '91dd2342-f23d-4550-b4f7-2f7d99b79e54'
WHERE id = '48574cdf-6984-4b89-b857-3fe1a9853e6e';
```

**2. Atualizar o stage do deal da Juliana para "Reuniao 01 Agendada":**

```sql
UPDATE crm_deals
SET stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53',
    stage_moved_at = NOW(),
    updated_at = NOW()
WHERE id = '91dd2342-f23d-4550-b4f7-2f7d99b79e54';
```

**3. Marcar o deal da Caroline como Perdido (duplicata):**

```sql
UPDATE crm_deals
SET stage_id = 'e7e92406-998d-4554-bfd0-770d9857df4a',
    stage_moved_at = NOW(),
    updated_at = NOW()
WHERE id = 'fe454fec-306e-4150-9fc7-c8cb34618926';
```

## Prevencao futura

Alem da correcao manual, atualizar o webhook `webhook-lead-receiver` para impedir criacao de deals duplicados quando ja existe um deal ativo para o mesmo contato na mesma pipeline criado recentemente (janela de 24h). Isso evita que o mesmo lead entre duas vezes por timing de webhooks.

### Arquivo: `supabase/functions/webhook-lead-receiver/index.ts`

Antes da insercao do deal, adicionar verificacao:

```typescript
// Verificar deal duplicado recente (mesma pipeline, mesmo contato, ultimas 24h)
const { data: recentDeal } = await supabase
  .from('crm_deals')
  .select('id')
  .eq('contact_id', contactId)
  .eq('origin_id', originId)
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .maybeSingle();

if (recentDeal) {
  console.log('[WEBHOOK] Deal duplicado detectado, ignorando:', recentDeal.id);
  return new Response(JSON.stringify({
    success: true,
    action: 'skipped',
    reason: 'duplicate_deal_recent',
    existing_deal_id: recentDeal.id,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

### Arquivo: `supabase/functions/webhook-live-leads/index.ts`

A mesma verificacao ja existe parcialmente (checa `contact_id` + `origin_id`), mas sem janela de tempo. O codigo atual ja previne duplicatas para LIVE leads.

## Resultado esperado

- O deal da Juliana (`91dd2342`) passa para "Reuniao 01 Agendada" com o meeting R1 vinculado
- O deal da Caroline (`fe454fec`) e marcado como Perdido
- Futuros webhooks duplicados sao bloqueados automaticamente pela janela de 24h
