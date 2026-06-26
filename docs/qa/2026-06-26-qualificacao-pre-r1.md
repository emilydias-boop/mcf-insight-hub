# Qualificação pré-R1 — três canais válidos

Data: 2026-06-26
Escopo: BU Incorporador MCF (BU Consórcio tem bypass automático).

## Princípio

Para agendar uma R1, o lead precisa estar qualificado por **uma** das três fontes abaixo. Nunca exigimos múltiplas gravações ou refazer a qualificação em outro canal para o mesmo lead.

## Matriz de qualificação

| # | Canal | Como qualifica | O que o sistema exige | Print/gravação |
|---|---|---|---|---|
| 1 | Ligação pelo sistema (IA) | SDR liga pelo discador Twilio; a IA transcreve e gera resumo | `deal_activities.activity_type = 'ai_call_summary'` registrado | Nenhuma ação extra do SDR |
| 2 | Ligação externa (telefone próprio) | SDR liga pelo celular pessoal e responde o questionário no modal | `qualification_note` com `metadata.channel = 'call'` + 6 respostas (≥15 chars) | Não exige gravação |
| 3 | WhatsApp | SDR qualifica via WhatsApp e responde o questionário no modal | `qualification_note` com `metadata.channel = 'whatsapp'` + 6 respostas (≥15 chars) | Print é opcional |

## Habilitação do botão "Agendar"

`QuickActionsBlock` consulta `useQualificationStatus(dealId)`. O botão fica habilitado quando `isQualified === true`. Exceção: stages de No-Show mantêm "Reagendar" sempre liberado.

## Comportamento do modal `QualificationAndScheduleModal`

- Se há resumo IA: banner verde no topo libera o agendamento. O questionário aparece como **complemento opcional**.
- Sem resumo IA: SDR escolhe "Ligação (sistema ou telefone próprio)" ou "Por WhatsApp" e responde as 6 perguntas. Nenhuma gravação nova é exigida.
- Botão "Salvar" valida que todas as 6 respostas tenham ≥15 chars apenas quando não há resumo IA.

## As 6 perguntas

Fonte: `src/components/crm/qualification/QualificationQuestions.ts`.

1. Há quanto tempo o lead conhece a MCF? (`tempo_mcf`)
2. Qual a profissão do lead? (`profissao`)
3. Possui algum sócio? (`socio`)
4. Qual a renda estimada? (`renda`)
5. Já constrói para venda? (`constroi_venda`)
6. Possui terreno/imóvel? (`terreno_imovel`)

## Onde olhar no código

- Status: `src/hooks/useQualificationStatus.ts` (aceita `ai_call_summary`, `channel='call'`, `channel='whatsapp'`).
- Persistência: `src/hooks/useQualificationNote.ts` (`useSaveQualificationNote`).
- UI: `src/components/crm/QualificationAndScheduleModal.tsx`.
- Bypass por BU: BU Consórcio retorna `isQualified=true` direto em `useQualificationStatus`.

## O que mudou em 2026-06-26

- Aceitamos qualificação por ligação externa (`channel='call'`).
- Print do WhatsApp deixou de ser obrigatório (continua aceito como anexo).
- Modal exibe o questionário também quando há resumo IA, como complemento opcional.