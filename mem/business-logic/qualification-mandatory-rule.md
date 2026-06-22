---
name: Regra de qualificação obrigatória
description: Lead só pode agendar R1 após qualificação por ligação (resumo IA) ou WhatsApp (questionário 6 perguntas + print)
type: feature
---
Regra implementada via `useQualificationStatus(dealId)`:
- Considera qualificado se houver `deal_activities.activity_type = 'ai_call_summary'` OU `qualification_note` com `metadata.channel='whatsapp'`, `whatsapp_print_url` preenchido e as 6 respostas com ≥15 chars cada.
- 6 perguntas em `src/components/crm/qualification/QualificationQuestions.ts` (tempo_mcf, profissao, socio, renda, constroi_venda, terreno_imovel).
- Botão "Agendar" em `QuickActionsBlock` fica disabled+tooltip enquanto não qualificado (exceto em stages No-Show, onde "Reagendar" permanece liberado).
- Print do WhatsApp vai para o bucket privado `qualification-attachments` (RLS: insert/select authenticated; delete pelo owner). URL exibida via signed URL em `DealNotesTab` e no uploader.
- `useSaveQualificationNote` grava `channel`, `answers` e `whatsapp_print_url` em `crm_deals.custom_fields` e no `metadata` da `deal_activity` `qualification_note`.