---
name: Escopo da qualificação obrigatória por BU
description: Qualificação obrigatória antes de agendar R1 só vale para BU - Incorporador MCF; Consórcio e Solar são isentas (lista centralizada em constante).
type: feature
---
Regra: `useQualificationStatus` retorna `isQualified=true` automaticamente quando a BU ativa estiver na constante exportada `BU_SEM_QUALIFICACAO_OBRIGATORIA` (definida em `src/hooks/useQualificationStatus.ts`), que hoje contém `'consorcio'` e `'solar'`. A obrigatoriedade de ligação com resumo IA ou questionário (WhatsApp/ligação externa, 6 perguntas) só se aplica à BU - Incorporador MCF. Demais BUs podem agendar R1 sem qualificação prévia até decisão contrária.

A lista é centralizada na constante `BU_SEM_QUALIFICACAO_OBRIGATORIA` — sempre importá-la em vez de duplicar a checagem `=== 'consorcio'` em outros pontos. O `reason` do bypass reflete a BU ativa: `BU - <codigo>: qualificação não exigida`.
