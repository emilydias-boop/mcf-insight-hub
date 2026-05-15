---
name: SDR Meu Histórico Tab
description: Aba "Meu Histórico" no CRM (BUCRMLayout + /crm) com Ligações, R1, No-Shows e Perdidas para SDRs/Closers; gestores filtram por SDR
type: feature
---
- Rota: `<bu>/crm/meu-historico` (Consorcio + legacy /crm); registrada em BUCRMLayout para todas as BUs.
- Liberada para sdr/closer/closer_sombra/coordenador/manager/admin.
- SDR/Closer vê apenas o próprio histórico (calls.user_id = auth.uid(), meeting_slot_attendees.booked_by = auth.uid()).
- Privileged (admin/manager/coordenador) ganha dropdown "Visualizar SDR" no topo.
- Calls ganharam 3 colunas novas: follow_up_action (retornar/whatsapp/sem_interesse/agendado/outro), follow_up_at, summary.
- Resumo é manual (sem IA por ora — não há transcrição armazenada das gravações Twilio).
- R1/No-Show/Perdidas vêm de meeting_slot_attendees + meeting_slots, bucket derivado de status + contract_paid_at.
