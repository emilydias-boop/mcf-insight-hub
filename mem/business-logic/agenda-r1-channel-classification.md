---
name: Agenda R1 channel classification
description: Regra de canal A010/ANAMNESE/Outro na Agenda R1 com window de 30 dias para reclassificar A010 antigo
type: feature
---
Classificação UNIFICADA — usada na Agenda R1 (`/crm/agenda` aba Lista + filtro Canal + export Excel) E no Funil por Canal do Relatório (`useChannelFunnelReport` → `classifyChannelWith30dRule`). As duas implementações DEVEM produzir o mesmo canal para o mesmo lead.

**Identificação A010**: lookup em `public.hubla_transactions` filtrando `product_category='a010'` e `sale_status='completed'`, por `customer_email` (lower/trim) ou últimos 9 dígitos de `customer_phone`. (NÃO usar `a010_sales` — está incompleta.) Quando há mais de uma venda do mesmo lead, usar a `sale_date` MAIS RECENTE.

**Window de 30 dias**: idade = `referenceDate - max(sale_date)`, onde `referenceDate` é a DATA DO EVENTO (R1 `scheduled_at` na Agenda; deal `created_at` no funil). NÃO usar `Date.now()` — isso fazia o canal de uma R1 antiga mudar com o tempo. Se idade >30 dias, considera-se "A010 esfriado".

**Tag ANAMNESE** vale APENAS se a tag for exatamente `ANAMNESE` (uppercase, trim) — anamnese completa. NÃO contar `ANAMNESE-INSTA`, `ANAMNESE INSTA`, `LIVE`, `LANÇ`, etc. Esses casos caem em **Outro/OUTROS**.

**Regra final** (em ordem):
1. Buyer A010 com venda ≤30 dias → **A010** (mesmo se tiver tag ANAMNESE).
2. Buyer A010 com venda >30 dias → **ANAMNESE** automaticamente (lead esfriou, vira anamnese independente de tag).
3. Não-buyer com tag exata `ANAMNESE` → **ANAMNESE**.
4. Resto → **Outro** (no Funil aparece como `OUTROS`).

Implementação:
- Agenda: `src/components/crm/MeetingsList.tsx` (`classifySimple` + `a010Age`) e `src/pages/crm/Agenda.tsx` (export Excel).
- Relatório Funil: `src/hooks/useChannelFunnelReport.ts` (`classifyChannelWith30dRule`).

Ao mudar a regra, atualizar TODOS os 3 lugares juntos para manter consistência.
