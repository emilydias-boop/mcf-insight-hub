

## Lembretes de Reunião por Email — Plano B (ActiveCampaign + Tags)

### Visão geral do fluxo

```text
┌──────────────────────────────────────────────────────────────────┐
│ pg_cron a cada 5 min                                             │
│        │                                                         │
│        ▼                                                         │
│ Edge Function: meeting-reminders-cron                            │
│  1. Busca reuniões scheduled/rescheduled nas próximas 26h        │
│  2. Para cada attendee × offset, calcula janela ±5 min           │
│  3. Verifica deduplicação + blacklist + link Meet existente      │
│  4. Resolve link Meet (closer_meeting_links → fallback)          │
│  5. Chama activecampaign-send (modo sync_with_tag)               │
│        │                                                         │
│        ▼                                                         │
│ activecampaign-send (refatorado)                                 │
│  1. Sincroniza contato com campos customizados                   │
│  2. Adiciona tag única (ex: reminder_d-1)                        │
│        │                                                         │
│        ▼                                                         │
│ ActiveCampaign (configurado pelo time de marketing)              │
│  1. Automação detecta tag                                        │
│  2. Dispara email com template visual da AC                      │
│  3. Remove a tag (para permitir reentrada futura se reagendar)   │
└──────────────────────────────────────────────────────────────────┘
```

### Cronograma dos 6 lembretes

| Tag (offset) | Quando dispara | Foco da mensagem (sugestão para AC) |
|---|---|---|
| `reminder_d-1` | 24h antes (±5 min) | Confirmação, prepare ambiente |
| `reminder_h-4` | 4h antes | Salve o link do Meet |
| `reminder_h-2` | 2h antes | Adicione ao calendar |
| `reminder_h-1` | 1h antes | Última chance de reagendar |
| `reminder_m-20` | 20 min antes | Teste câmera/microfone |
| `reminder_m-0` | hora exata | "Estamos te esperando agora" |

### Setup necessário no ActiveCampaign (uma vez)

**Campos customizados de contato** que a edge function vai popular:
- `meeting_link` (URL do Google Meet)
- `meeting_date` (data formatada pt-BR)
- `meeting_time` (hora HH:mm)
- `meeting_type` (R1 / R2)
- `closer_name` (nome do closer)
- `sdr_name` (nome do SDR)
- `whatsapp_owner` (telefone do owner para reagendamento)
- `bu_name` (Business Unit)

**6 tags** que a edge function vai aplicar:
`reminder_d-1`, `reminder_h-4`, `reminder_h-2`, `reminder_h-1`, `reminder_m-20`, `reminder_m-0`

**6 Automations** (1 por tag), cada uma:
- Trigger: tag adicionada
- Ação: enviar email do template correspondente (usando os custom fields acima)
- Ação final: remover a tag (importante para permitir reentrada se a reunião for reagendada)

A UI admin no Lovable vai mostrar **um checklist visual** com esses 6 + 8 itens para o time de marketing acompanhar o setup na AC.

### Acionamento da função (cron)

Job pg_cron executando a cada 5 minutos, chamando a edge function via `pg_net.http_post`:

```sql
select cron.schedule(
  'meeting-reminders-every-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/meeting-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);
```

A edge function usa `verify_jwt = false` (padrão dos crons já existentes no projeto) e roda com service role internamente.

**Acionamento manual também disponível** via botão "Executar agora" na UI admin (chama a mesma edge function), útil para testar sem esperar 5 min.

### Banco de dados (1 migration)

```sql
-- Log/dedupe (constraint UNIQUE garante 1 envio por attendee por offset)
create table public.meeting_reminders_log (
  id uuid primary key default gen_random_uuid(),
  meeting_slot_id uuid not null references meeting_slots(id) on delete cascade,
  attendee_id uuid not null references meeting_slot_attendees(id) on delete cascade,
  contact_email text not null,
  offset_key text not null,
  meeting_type text not null,
  status text not null,         -- sent | failed | skipped
  skip_reason text,             -- no_email | no_link | blacklisted | cancelled
  ac_contact_id text,
  error_message text,
  scheduled_at timestamptz,
  sent_at timestamptz default now(),
  unique (attendee_id, offset_key)
);

-- Settings globais (1 linha)
create table public.meeting_reminder_settings (
  id int primary key default 1,
  is_active boolean default false,             -- começa desligado
  enabled_offsets text[] default array['d-1','h-4','h-2','h-1','m-20','m-0'],
  apply_to_r1 boolean default true,
  apply_to_r2 boolean default true,
  fallback_meeting_link text,
  ac_list_id int,                              -- lista AC opcional
  ac_setup_confirmed boolean default false,    -- admin marca quando setup AC pronto
  updated_at timestamptz default now()
);

insert into public.meeting_reminder_settings (id) values (1);

-- RLS: admin/coordenador full, demais leitura nada
alter table public.meeting_reminders_log enable row level security;
alter table public.meeting_reminder_settings enable row level security;
-- (políticas usando has_role)
```

### Edge Function `meeting-reminders-cron` (lógica)

1. Carrega `meeting_reminder_settings`. Se `is_active = false` ou `ac_setup_confirmed = false`, retorna `{skipped: true}` sem fazer nada.
2. Query principal:
   ```sql
   select ms.*, msa.id as attendee_id, msa.status as attendee_status,
          c.email, c.name, c.phone,
          d.name as deal_name, d.owner_id, d.bu_origem
   from meeting_slots ms
   join meeting_slot_attendees msa on msa.meeting_slot_id = ms.id
   join crm_deals d on d.id = msa.deal_id
   left join crm_contacts c on c.id = d.contact_id
   where ms.scheduled_at between now() and now() + interval '26 hours'
     and ms.status in ('scheduled','rescheduled')
     and msa.status in ('invited','scheduled')
   ```
3. Para cada linha × cada offset habilitado:
   - Calcula `target = scheduled_at - offset`. Se `|now - target| > 5 min`, pula.
   - Verifica `meeting_reminders_log` por `(attendee_id, offset_key)` → se existe, pula.
   - Verifica filtros: sem email → log `skipped/no_email`; em `automation_blacklist` → log `skipped/blacklisted`; sem link Meet (lookup `closer_meeting_links` + fallback) → log `skipped/no_link`.
   - Resolve nomes (closer, sdr/owner, BU) e telefone do owner.
   - POST para `activecampaign-send` com:
     ```json
     {
       "mode": "sync_with_tag",
       "email": "lead@x.com",
       "name": "Lead Name",
       "tag": "reminder_d-1",
       "listId": 123,
       "customFields": {
         "meeting_link": "https://meet.google.com/xxx",
         "meeting_date": "25/04/2026",
         "meeting_time": "14:00",
         "meeting_type": "R1",
         "closer_name": "...",
         "sdr_name": "...",
         "whatsapp_owner": "+55...",
         "bu_name": "Incorporador"
       }
     }
     ```
   - Loga resultado em `meeting_reminders_log`.
4. Retorna resumo `{processed, sent, skipped, failed}`.

### Refatoração do `activecampaign-send`

Adicionar suporte ao `mode`:
- `mode = 'sync_with_tag'` (novo): só sincroniza contato + custom fields + adiciona tag. **Não tenta enviar transacional**. Retorna `{success, contactId, tagApplied}`.
- `mode = 'transactional'` (default, comportamento atual mantido para não quebrar nada).

Para custom fields, usa endpoint `/fieldValues` da AC mapeando nome → ID (descobre IDs via `/fields?limit=100` em uma chamada cacheada na primeira execução, salvando em `meeting_reminder_settings.ac_field_ids` JSON).

### UI Admin: nova aba em `/admin/automacoes`

Aba **"Lembretes de Reunião"** com seções:

**1. Status & toggle global**
- Switch `is_active` (alerta vermelho se ligar sem `ac_setup_confirmed`).
- Botão "Executar cron agora" (chama edge function manualmente para teste).

**2. Checklist de setup AC** (`ACSetupChecklist`)
- Lista os 8 custom fields esperados + 6 tags + 6 automations.
- Checkbox manual para o admin marcar "configurado".
- Quando todos marcados, libera `ac_setup_confirmed = true`.
- Botão para copiar nomes técnicos (`reminder_d-1`, `meeting_link`, etc).

**3. Configurações**
- Checkboxes por offset (admin pode desligar `d-1` se quiser).
- Switch R1/R2.
- Input fallback Meet link.
- Input ID da Lista AC.

**4. Health check de links Meet**
- Mostra "X de Y closers ativos têm link Meet configurado".
- Lista os closers sem link com botão para ir cadastrar.

**5. Logs (últimos 100 envios)**
- Tabela: data, attendee, offset, status, motivo skip/erro, link AC contact.
- Filtros: status, offset, período.

**6. Métricas**
- Cards: enviados / skipped / falhas (24h, 7d, 30d).
- Breakdown por offset.

### Arquivos afetados

**Novos:**
- `supabase/migrations/<ts>_meeting_reminders.sql`
- `supabase/functions/meeting-reminders-cron/index.ts`
- `src/components/automations/MeetingRemindersSettings.tsx`
- `src/components/automations/MeetingRemindersLogs.tsx`
- `src/components/automations/MeetingRemindersMetrics.tsx`
- `src/components/automations/ACSetupChecklist.tsx`
- `src/hooks/useMeetingReminderSettings.ts`
- `src/hooks/useMeetingRemindersLogs.ts`
- `src/hooks/useMeetingRemindersMetrics.ts`

**Editados:**
- `supabase/functions/activecampaign-send/index.ts` (adicionar `mode: sync_with_tag`)
- `src/pages/admin/Automacoes.tsx` (nova aba + import)

### Cuidados / regras de negócio

1. **Reagendamento**: ao detectar `meeting_slots.updated_at > log.sent_at` E `scheduled_at` mudou, deletar logs daquele attendee para reenviar a sequência do zero.
2. **Cancelamento / no-show**: filtro de status no SELECT já garante que não envia mais nada.
3. **Janela ±5 min**: se cron atrasar, ainda pega; UNIQUE constraint garante dedupe.
4. **Sem link Meet**: skipa silenciosamente (log) — admin vê na seção de health check quem precisa cadastrar.
5. **Volume estimado**: ~50 reuniões/dia × 6 = ~300 emails/dia. Plano AC suporta volume bem maior.
6. **Timezone**: tudo UTC no banco; format pt-BR (`America/Sao_Paulo`) só nos custom fields enviados pra AC.
7. **Começar desligado**: `is_active = false` por padrão; admin liga só quando setup AC estiver completo.

### Validação pós-deploy

1. Migration aplicada → tabelas criadas, cron agendado e visível em `cron.job`.
2. Time de marketing cria os 8 custom fields, 6 tags, 6 automations na AC.
3. Admin abre aba "Lembretes" → marca todos os checks → ativa global.
4. Criar reunião teste daqui ~25h com closer com link Meet → após 1h, log mostra `reminder_d-1` enviado, contato aparece na AC com a tag e custom fields populados, automation dispara o email.
5. Esperar e validar os outros 5 offsets disparando nas janelas certas, sem duplicar.
6. Reagendar a reunião → confirmar que logs antigos são limpos e nova sequência começa.
7. Marcar attendee como `no_show` antes de `m-0` → confirmar que `m-0` não dispara.
8. Botão "Executar cron agora" funciona e dispara processamento imediato.

