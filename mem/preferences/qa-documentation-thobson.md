---
name: QA Documentation for Thobson Features
description: Sempre que thobson.motta@minhacasafinanciada.com solicitar mudança/feature, criar documento de QA com roadmap de testes em docs/qa/.
type: preference
---

**Regra:** Quando `thobson.motta@minhacasafinanciada.com` solicitar uma mudança ou nova feature, gerar `docs/qa/<AAAA-MM-DD>-<slug>.md`.

**Estrutura obrigatória:**
1. Metadados (data, solicitante, módulo/BU, status)
2. Contexto e objetivo
3. Escopo (in/out)
4. Arquivos, rotas e tabelas afetadas
5. Critérios de aceite
6. Roadmap de testes: funcionais, edge cases, regressão, permissões/RLS, UI/UX
7. Riscos e plano de rollback
8. Checklist final de validação

**Por quê:** Rastreabilidade e validação consistente das entregas do Thobson.
**Como aplicar:** Criar junto da entrega e referenciar na resposta.