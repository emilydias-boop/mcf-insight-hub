## Objetivo

Remover por completo a funcionalidade de "Marcações Especiais R2" — a regra que destacava reuniões da closer **Leticia Faustino** quando o lead era **ANAMNESE** e o contrato estava pago. Vamos parar de captar anamnese paga; o que sobrar (orgânico do Instagram/Live) continua sendo identificado pela tag `ANAMNESE` normalmente, mas sem nenhuma marcação visual especial nem regra por closer.

## O que muda

### 1. Banco de dados (migration)
- `DROP TABLE public.r2_special_markings CASCADE` (apaga a única regra existente: "Anamnese - Leticia Faustino").
- Remover policies/triggers associados, se houver.

### 2. Frontend — arquivos deletados
- `src/types/r2SpecialMarking.ts`
- `src/hooks/useR2SpecialMarkings.ts`
- `src/components/crm/R2SpecialMarkingsConfigModal.tsx`

### 3. Frontend — arquivos editados (remover imports, hooks e renderização de badge especial)
- `src/components/crm/AgendaCalendar.tsx` — remover `useActiveR2SpecialMarkings`, `matchR2SpecialMarking` e o `Map` de markings; o calendário volta a renderizar apenas badges padrão de canal (A010/ANAMNESE/Outro).
- `src/components/crm/R2CloserColumnCalendar.tsx` — idem.
- `src/components/crm/R2LeadBadges.tsx` — idem; manter o badge de canal normal.
- `src/components/crm/R2MeetingDetailDrawer.tsx` — idem.
- `src/pages/crm/AgendaR2.tsx` — remover import do modal, state `markingsConfigOpen`/`setMarkingsConfigOpen`, botão que abre a config e a renderização do `<R2SpecialMarkingsConfigModal />`.

### 4. O que **não** muda
- Classificação de canal `A010 / ANAMNESE / Outro` continua igual (`r2ChannelClassify.ts`, `useAttendeeChannels`, `useR2LeadsChannelMap`). Leads orgânicos com tag `ANAMNESE` seguem sendo identificados como ANAMNESE — só perdem a marcação visual extra por closer.
- Nenhuma mudança em fluxo de venda, pagamento de contrato ou comissionamento.

## Notas técnicas
- Não há referências cruzadas fora desses 8 arquivos (verificado via grep por `SpecialMarking`/`special_marking`).
- A regra atual no banco (`id 59de7395-…`, closer `3f298f4e-…`) é a única; o `DROP TABLE` é suficiente.
- Migrations antigas (`20260512133944_…` e `20260512135130_…`) ficam preservadas no histórico; apenas adicionamos a migration de remoção por cima.
