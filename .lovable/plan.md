# Usar o link real da agenda do closer em todas as automações

## Problema

Hoje o `{{link}}` enviado nas mensagens automatizadas pode vir de fontes diferentes (e ocasionalmente de um link genérico/test), em vez de vir sempre do **mesmo lugar que o closer usa na agenda** (`closer_meeting_links`).

Além disso, o cron de lembretes faz o lookup em **UTC**, enquanto a agenda do closer está cadastrada em **America/Sao_Paulo** — quando o horário UTC não bate com a chave `day_of_week + start_time` (BRT), o lookup falha e cai no fallback.

## Fonte de verdade

Tabela `closer_meeting_links` (chave: `closer_id` + `day_of_week` + `start_time` em BRT). É a mesma tabela que popula a agenda do closer no CRM.

## Mudanças

### 1. `supabase/functions/automation-processor/index.ts` (confirmação R1 Agendada etc.)

Substituir o bloco que resolve `meetingLink` (linhas ~301–305) por:

1. Se houver `meetingSlotActive.closer_id` e `scheduled_at`, calcular `day_of_week` e `start_time` **em America/Sao_Paulo**.
2. `SELECT google_meet_link FROM closer_meeting_links WHERE closer_id=? AND day_of_week=? AND start_time=?`.
3. Cascata final:
   - `closer_meeting_links.google_meet_link` (real, da agenda)
   - `meeting_slots.meeting_link`
   - `meeting_slots.video_conference_link`
   - (remover `closers.calendly_default_link` da cascata — é o "link test" genérico)
4. Se mesmo assim vier vazio → `markAsSkipped(item, 'meeting_link_unresolved')` para não enviar mensagem sem link.

### 2. `supabase/functions/meeting-reminders-cron/index.ts`

Corrigir o lookup para usar BRT em vez de UTC (linhas ~209–217):

- Trocar `slotDate.getDay()` por dia-da-semana em `America/Sao_Paulo`.
- Trocar `slotDate.toISOString().substring(11,19)` por `HH:mm:ss` em `America/Sao_Paulo`.

Helper compartilhado (inline em cada função):
```ts
function getBRTDayAndTime(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  const weekdayMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  const wd = weekdayMap[fmt.find(p => p.type==='weekday')!.value];
  const hh = fmt.find(p => p.type==='hour')!.value.padStart(2,'0');
  const mm = fmt.find(p => p.type==='minute')!.value.padStart(2,'0');
  const ss = fmt.find(p => p.type==='second')!.value.padStart(2,'0');
  return { day_of_week: wd, start_time: `${hh}:${mm}:${ss}` };
}
```

### 3. Logs

Adicionar log claro quando o link for resolvido vs. fallback:
```
[AUTOMATION-PROCESSOR] deal=… link_source=closer_meeting_links|meeting_slots|fallback link=…
[MEETING-REMINDERS-CRON] slot=… link_source=…
```
Isso permite auditar via Edge Function logs se algum envio ainda usou link errado.

### 4. Não muda

- UI de cadastro de links (`/admin/automacoes` → Lembretes, e a agenda do closer).
- Templates / variáveis.
- `meeting_reminder_settings.fallback_meeting_link` continua existindo, mas só é usado se realmente não houver link na agenda do closer (continua sendo logado como `link_source=fallback`).

## Validação

1. Após deploy, chamar manualmente `automation-processor` e `meeting-reminders-cron` via `curl_edge_functions`.
2. Verificar nos logs que `link_source=closer_meeting_links` para os slots cujo closer tem entrada cadastrada.
3. Conferir 1 mensagem real no `automation_logs` / `meeting_reminders_log` para o link enviado bater com o `closer_meeting_links.google_meet_link` do horário.
