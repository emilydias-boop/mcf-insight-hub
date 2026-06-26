---
name: Regra de qualificação obrigatória
description: Lead só pode agendar R1 após qualificação por resumo IA, ligação externa (questionário) ou WhatsApp (questionário) — print não é mais exigido
type: feature
---
Regra implementada via `useQualificationStatus(dealId)` — três fontes válidas, basta UMA:
1. `deal_activities.activity_type = 'ai_call_summary'` (ligação pelo discador do sistema, transcrita pela IA).
2. `qualification_note` com `metadata.channel = 'call'` e as 6 respostas com ≥15 chars (ligação externa, telefone próprio).
3. `qualification_note` com `metadata.channel = 'whatsapp'` e as 6 respostas com ≥15 chars (WhatsApp).

Princípio: nunca exigir múltiplas gravações ou refazer a qualificação em mais de um canal para o mesmo lead. Se a IA já qualificou, o questionário fica como complemento opcional no modal.

Detalhes:
- 6 perguntas em `src/components/crm/qualification/QualificationQuestions.ts` (tempo_mcf, profissao, socio, renda, constroi_venda, terreno_imovel).
- Botão "Agendar" em `QuickActionsBlock` fica disabled+tooltip enquanto não qualificado (exceto stages No-Show, onde "Reagendar" permanece liberado).
- Print do WhatsApp deixou de ser obrigatório. O bucket `qualification-attachments` e o `WhatsappPrintUploader` continuam disponíveis para upload opcional/histórico, mas não bloqueiam a qualificação.
- `useSaveQualificationNote` grava `channel` ('call' | 'whatsapp'), `answers` e `whatsapp_print_url` (nullable) em `crm_deals.custom_fields` e no `metadata` da `deal_activity` `qualification_note`.
- BU Consórcio mantém bypass total (`isQualified=true` automático).