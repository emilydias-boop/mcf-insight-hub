# Inventário: qualificação obrigatória pré-R1 (somente mapeamento, nada será alterado)

## 1. useSaveQualificationNote
Arquivo: `src/hooks/useQualificationNote.ts`
- `crm_deals.custom_fields` (via RPC `crm_deal_merge_custom_fields`, que ignora null/''): chaves do legado `qualificationData` (espalhadas, se enviado) + `leadSummary`, `qualification_saved`, `qualification_date`, `qualification_channel` ('call'|'whatsapp'), `qualification_answers`, `whatsapp_print_url`. Não existe chave `fonte` nem `channel` "puro".
- `deal_activities`: `activity_type='qualification_note'`, `description=summary`, `user_id`; `metadata`: `qualification_data`, `para_r1`, `sdr_name`, `qualified_at`, `channel`, `answers`, `whatsapp_print_url`, + `extraMetadata` (ex.: `conversation_id`).
- Invalida: `crm-deal`, `crm-deals`, `deal-activities`, `qualification-status`, `all-deal-notes`.

## 2. Modal/questionário
- Modal principal do SDR: `src/components/crm/QualificationAndScheduleModal.tsx` — importa `QUALIFICATION_QUESTIONS`, `validateAnswers`, `answersToSummary` de `./qualification/QualificationQuestions`; renderiza `QualificationQuestionnaire`, `WhatsappPrintUploader`, `QualificationSummaryCard`; também usa legado `QualificationFields`.
- Variante WhatsApp/check-in: `src/components/checkin/QualifyLeadDialog.tsx` (channel fixo 'whatsapp').
- Abertos por: `DealDetailsDrawer.tsx`, `QuickScheduleModal.tsx`, `MainLayout.tsx`, `checkin/ContactPanel.tsx`.

Todos que importam `QualificationQuestions.ts`:
- `src/components/crm/QualificationAndScheduleModal.tsx`
- `src/components/crm/qualification/QualificationQuestionnaire.tsx`
- `src/components/crm/DealNotesTab.tsx` (só `QUALIFICATION_QUESTIONS`)
- `src/components/checkin/QualifyLeadDialog.tsx`
- `src/hooks/useQualificationStatus.ts`
- `src/hooks/useQualificationNote.ts` (só tipo)

## 3. Bloqueio do "Agendar"
- `src/components/crm/QuickActionsBlock.tsx`: `useQualificationStatus(deal?.id)` → `isQualified`; botão `disabled={!isQualified && !isNoShowStage}` + tooltip.
- `src/components/crm/QuickScheduleModal.tsx`: `needsQualification` (deal selecionado, não bloqueado, não reagendamento No-Show, `isQualified === false`) → abre automaticamente o modal de qualificação.
- `QualificationAndScheduleModal.tsx`: `isActuallyQualified` decide banner IA / validação do salvar.
- `useQualificationStatus` (`src/hooks/useQualificationStatus.ts`): bypass por `BU_SEM_QUALIFICACAO_OBRIGATORIA` (`consorcio`,`solar`,`credito`); senão aceita `ai_call_summary` ou `qualification_note` com `channel` call/whatsapp e respostas válidas.

## 4. Badge icp_segment
- Componente: `src/components/crm/LeadSegmentBadge.tsx` — só A/B/C; qualquer outro valor (ex.: 'ICP') retorna `null` (não renderiza).
- Card kanban: `DealKanbanCard.tsx` (linha ~405).
- Drawer do lead: `DealDetailsDrawer.tsx` → `SdrCompactHeader.tsx`.
- Também em: `AgendaMeetingDrawer.tsx`, `AgendaCalendar.tsx`, `CloserColumnCalendar.tsx`, `MeetingsList.tsx` (`resolveLeadSegment` A/B/C senão null), `R2CloserColumnCalendar.tsx` (normalização própria), `sdr/MeetingsTable.tsx` (só A/B com ternário).
- Normalizações que descartam outros valores: `useDealsIcpSegments.ts` (só A/B), `useSdrMeetingsFromAgenda.ts`, `QuickScheduleModal.normalizeIcpSegment` (A/B/C → senão null, gatilho do banco decide).

## 5. Filtros por icp_segment
- `src/hooks/useR1CloserMetrics.ts` (`IcpSegmentFilter` 'all'|A|B|C) — usado em `pages/crm/ReunioesEquipe.tsx`, `pages/bu-consorcio/PainelEquipe.tsx`, `closer/CloserRankingBlock.tsx`, `closer/CloserDetailKPICards.tsx`, `pages/closer/MeuDesempenhoCloser.tsx`, `sdr/CloserSummaryTable.tsx`, `sdr/ConsorcioCloserSummaryTable.tsx`.
- `src/hooks/useGoalsMatrixValues.ts` + `useDealsIcpSegments.ts` (A/B).
- Agrupamento (não filtro): `pages/sdr/MinhasReunioes.tsx` ('Sem ICP'), `sdr/MeetingSummaryCards.tsx`.
- `useUnassignedContracts.ts` lê icp_segment.
- Nenhum filtro encontrado no kanban de Negócios.

## 6. BU no modal
- `QualificationAndScheduleModal` e `QualifyLeadDialog` são agnósticos: não usam `useBUContext`/`useActiveBU`.
- A BU só entra via `useQualificationStatus` (`useBUContext().activeBU`).
