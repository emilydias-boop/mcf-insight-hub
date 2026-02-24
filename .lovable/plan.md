
Objetivo: fazer os SDRs voltarem a ver a lista de leads em **/sdr/minhas-reunioes** com os nomes corretos.

## Diagnóstico confirmado

1. O problema atual não é mais `is_rescheduled`:
   - Agora a RPC está quebrando com erro SQL `42703: column ms.slot_date does not exist`.
2. A função publicada `get_sdr_meetings_from_agenda(text,text,text)` ainda usa colunas inexistentes no schema atual:
   - `ms.slot_date`
   - `ms.start_time`
3. No schema real, `meeting_slots` usa:
   - `scheduled_at` (timestamptz)
   - não possui `slot_date` nem `start_time`.
4. Resultado no frontend:
   - KPIs aparecem (vem de outra RPC: `get_sdr_metrics_from_agenda`)
   - tabela de reuniões fica vazia/sem nomes porque a RPC da lista falha em 400.

## Implementação proposta

### 1) Corrigir a função SQL `get_sdr_meetings_from_agenda`
Criar uma nova migration para **drop + recreate** da função com o schema correto.

Ajustes na função:
- Trocar `ms.slot_date` por `ms.scheduled_at`.
- Trocar `ms.start_time` por `ms.scheduled_at`.
- Manter `msa.is_reschedule` (nome correto da coluna).
- Usar SDR de forma consistente com as métricas:
  - join de perfil via `COALESCE(msa.booked_by, ms.booked_by)` para robustez.
- `intermediador` com fallback:
  - `COALESCE(profile.full_name, profile.email, '')`.
- Filtro por SDR com comparação case-insensitive:
  - `LOWER(profile.email) = LOWER(sdr_email_filter)`.
- Manter exclusões:
  - `msa.status != 'cancelled'`
  - `COALESCE(msa.is_partner, false) = false`
  - `ms.meeting_type = 'r1'`.
- Ordenação por `ms.scheduled_at DESC`.

Observação técnica:
- `scheduled_at` deve voltar como timestamp (string no client), não `time`, para não quebrar `new Date(...)` na tabela.

### 2) Garantir compatibilidade com o frontend atual
Sem alterar hooks/componentes neste passo, apenas garantir que o contrato da RPC continue trazendo os campos já consumidos:
- `deal_id, deal_name, contact_name, contact_email, contact_phone, tipo, data_agendamento, scheduled_at, status_atual, intermediador, closer, origin_name, probability, attendee_id, meeting_slot_id, attendee_status, sdr_email`.

### 3) Validação pós-correção
Validar em 3 níveis:

1. Banco:
   - chamada SQL/RPC retorna 200 e linhas para um SDR conhecido.
2. Rede no browser:
   - `POST /rpc/get_sdr_meetings_from_agenda` sem 400.
3. Tela:
   - em `/sdr/minhas-reunioes`, a grade deixa de exibir “Nenhuma reunião encontrada...” e mostra os leads com nomes.

## Critérios de aceite

- SDR consegue visualizar sua lista em “Minhas Reuniões”.
- Nomes de lead (`contact_name`) aparecem na tabela.
- Não existe mais erro `column ms.slot_date does not exist` no console.
- KPI e tabela voltam a ficar coerentes operacionalmente (sem estado “cards com dados + lista vazia por erro”).

## Risco e mitigação

- Risco: nova regressão na RPC por drift de schema.
- Mitigação: usar apenas colunas confirmadas no schema atual (`scheduled_at`, `meeting_slot_id`, `is_reschedule`) e validar imediatamente via chamada RPC real antes de encerrar.
