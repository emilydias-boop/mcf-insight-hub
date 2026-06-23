---
name: Escopo da qualificação obrigatória por BU
description: Qualificação obrigatória antes de agendar R1 só vale para BU - Incorporador MCF; Consórcio bypassa.
type: feature
---
Regra: `useQualificationStatus` retorna `isQualified=true` automaticamente quando `useBUContext().activeBU === 'consorcio'`. A obrigatoriedade de ligação com resumo IA ou questionário WhatsApp (6 perguntas) só se aplica à BU - Incorporador MCF. Demais BUs (consórcio confirmado, futuras crédito/projetos/leilão) podem agendar R1 sem qualificação prévia até decisão contrária.