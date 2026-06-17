# QA — Agente de Transcrição e Resumo IA de Ligações Twilio

**Autor:** thobson.motta@minhacasafinanciada.com
**Data:** 17/06/2026
**Status:** Implementado (pendente configuração Twilio Voice Intelligence)

## Resumo da feature

Toda ligação Twilio com duração ≥ 60s passa a ser:
1. Transcrita automaticamente pelo Twilio Voice Intelligence (PT-BR).
2. Resumida pela IA (Lovable AI Gateway / Gemini 3 Flash) com:
   - 3 a 5 bullets de pontos-chave;
   - Respostas ao script de descoberta MCF (tempo conhece MCF, profissão, renda, já constrói, possui imóvel, possui terreno, tem sócio);
   - Próximos passos sugeridos.
3. Gravada em três lugares:
   - `calls.ai_summary` + `calls.summary` (texto formatado);
   - `crm_deals.custom_fields.callSummaries` (histórico cronológico) e `deal_activities` (`ai_call_summary`) — visível na aba Notas do card do lead em qualquer stage;
   - `attendee_notes` (`note_type='call_summary'`) — para R1 e demais agendamentos vinculados ao deal.

## Componentes novos / alterados

| Tipo | Caminho |
|------|---------|
| Edge function (nova) | `supabase/functions/twilio-transcript-callback/index.ts` |
| Edge function (alterada) | `supabase/functions/twilio-voice-webhook/index.ts` — dispara transcript ≥60s |
| Migration | `calls` + `attendee_notes` (novo `note_type`) |
| Frontend | `src/components/crm/DealNotesTab.tsx` — renderiza `ai_call_summary` |

## Pré-requisitos de configuração (manual)

1. Ativar **Voice Intelligence** no console Twilio.
2. Criar **Service** com `language_code=pt-BR`.
3. Configurar **webhook do Service** apontando para: `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-transcript-callback`.
4. Secret `TWILIO_VOICE_INTELLIGENCE_SERVICE_SID` configurado ✅

## Roteiro de testes funcionais

| # | Cenário | Pré-condição | Passos | Resultado esperado |
|---|---------|--------------|--------|--------------------|
| F1 | Ligação curta (<60s) | SDR logado, lead com telefone | Fazer ligação, encerrar em 30s | `calls.transcript_status = 'skipped_short'`. Nenhum transcript criado na Twilio. |
| F2 | Ligação efetiva (60-120s) | Idem | Conversar por 90s e encerrar | `calls.transcript_status = 'processing'` logo após. Em ~30s vira `'completed'` com `ai_summary` preenchido. |
| F3 | Ligação qualificada (>120s) | Idem | Conversar respondendo ao script | `ai_summary.discovery` deve conter as 7 respostas. Bullets devem refletir o áudio. |
| F4 | Resumo no card do lead | F2 ou F3 ok | Abrir o card do negócio → aba Notas | Aparece card "Resumo IA" com bullets, descoberta e próximos passos. Autor: 🤖 IA. |
| F5 | Resumo no agendamento R1 | F2/F3 + deal com R1 agendada | Abrir Agenda R1 → drawer do attendee → notas | Mesma nota aparece com `note_type='call_summary'`. |
| F6 | Persistência entre stages | F4 ok | Mover deal para próxima stage (R2, Contrato) | Resumo continua visível na aba Notas (histórico em `custom_fields.callSummaries`). |
| F7 | Idempotência | F2 ok | Reenviar o webhook `transcript.completed` | Edge function retorna `already_processed: true` sem duplicar nota. |
| F8 | Lead sem transcript | F2 falha (Twilio retorna empty) | Forçar áudio mudo de 90s | `calls.transcript_status = 'failed'`. Aba Notas sem novo registro. |

## Roteiro de regressão

| # | Item | Resultado esperado |
|---|------|--------------------|
| R1 | AMD continua funcionando (voicemail derruba a ligação) | Sem mudança vs comportamento atual. |
| R2 | `auto_move_deal_to_em_contato` ainda dispara em qualquer status terminal | Sem mudança. |
| R3 | Notas manuais antigas (`activity_type='note'`) continuam aparecendo na aba | Sem mudança. |
| R4 | Notas de Qualificação (`qualification_note`) continuam aparecendo | Sem mudança. |
| R5 | Notas de attendee genéricas (`note_type='general'`) continuam aparecendo | Sem mudança. |
| R6 | Ligações sem `deal_id` (cold call, ex.: discador) | Transcript ainda é criado, `calls.ai_summary` é salvo, mas nada é replicado em deals/attendees. Não deve gerar erro. |

## Pontos de atenção

- **Custo:** Twilio Voice Intelligence ≈ US$ 0,05/min transcrito. Filtro ≥60s + frequência atual deve manter custo controlado.
- **LGPD:** apenas o resumo é persistido no nosso banco; o transcript bruto fica na Twilio (link acessível via dashboard).
- **Rate limit Lovable AI:** se o gateway retornar 429/402, `calls.transcript_status` permanece `'processing'` indefinidamente — monitorar logs da função.
- **Modelo:** `google/gemini-3-flash-preview` (default da plataforma). Trocar se a qualidade do PT-BR sair fraca.