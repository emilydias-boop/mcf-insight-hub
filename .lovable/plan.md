

## Remover bloqueio de agendamento duplicado da Edge Function

### Problema identificado

O erro "Edge Function returned a non-2xx status code" ocorre porque a edge function `calendly-create-event` ainda possui uma guarda de duplicidade (linhas 330-374) que retorna HTTP 409 quando:

1. O deal ja possui uma reuniao ativa (status `invited`/`scheduled`)
2. O deal teve uma reuniao `completed` nos ultimos 30 dias

Embora o bloqueio tenha sido removido no frontend (nos modais `QuickScheduleModal` e `R2QuickScheduleModal`), a logica de bloqueio no servidor permaneceu ativa.

### Alteracao

**`supabase/functions/calendly-create-event/index.ts`**

- Remover o bloco "DUPLICATE MEETING GUARD" (linhas 330-377), que inclui:
  - Verificacao de `activeAttendees` com retorno 409
  - Verificacao de `recentCompleted` com cooldown de 30 dias e retorno 409
- Manter o log `"✅ No duplicate meeting found, proceeding..."` substituido por um simples `"📅 Proceeding with meeting creation..."`

### Resultado

O agendamento via agenda do Consorcio (e qualquer outra BU) funcionara sem restricoes de duplicidade, consistente com a remocao feita no frontend.

