---
name: Agenda R1 channel classification
description: Regra de canal A010/ANAMNESE/Outro na Agenda R1 com window de 30 dias para reclassificar A010 antigo
type: feature
---
Classificação SIMPLIFICADA usada APENAS na Agenda R1 (`/crm/agenda` aba Lista + filtro Canal + export Excel). NÃO usar `classifyChannel` aqui.

**Identificação A010**: lookup em `public.a010_sales` por `customer_email` (lower/trim) ou últimos 9 dígitos de `customer_phone`. Quando há mais de uma venda do mesmo lead, usar a `sale_date` MAIS RECENTE.

**Window de 30 dias**: idade = `Date.now() - max(sale_date)`. Se >30 dias, considera-se "A010 esfriado".

**Regra final** (em ordem):
1. Buyer A010 com venda ≤30 dias → **A010** (mesmo se tiver tag ANAMNESE).
2. Buyer A010 com venda >30 dias E deal tem tag `ANAMNESE`/`ANAMNESE-INSTA` → **ANAMNESE** (lead esfriou e voltou via anamnese).
3. Buyer A010 com venda >30 dias SEM tag ANAMNESE → continua **A010**.
4. Não-buyer com tag `ANAMNESE`/`ANAMNESE-INSTA` → **ANAMNESE**.
5. Resto → **Outro**.

Implementação: `src/components/crm/MeetingsList.tsx` (`classifySimple` + `a010Age`) e `src/pages/crm/Agenda.tsx` (export Excel reproduz a mesma regra).
