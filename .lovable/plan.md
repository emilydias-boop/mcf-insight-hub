
# Corrigir Dados e Proteger Busca por BU no Agendamento

## 1. Dados do Lead "Ailton Aparecido de Sa"

O deal de "Efeito Alavanca + Clube" (id: `f4895d29-305c-42b3-bb84-6400e686ff2c`) ja esta no estagio "VENDA REALIZADA 50K", que e mais avancado que "R1 Realizada". Nao e necessario corrigir o estagio desse deal.

O deal errado (Inside Sales, id: `1f374740-392f-4cc5-8d78-3206b85a8c82`) esta em "REUNIAO 1 REALIZADA" porque foi ele que ficou vinculado ao attendee. **Nenhuma correcao de dados e necessaria** ja que o deal correto ja progrediu alem de R1 Realizada.

## 2. Protecao no Codigo: Filtrar busca por BU

### Problema identificado

Na hora do agendamento (QuickScheduleModal), a busca por **nome** ja filtra por `originIds` da BU ativa. Porem, as buscas por **telefone** e **email** NAO aplicam esse filtro, permitindo que deals de outras BUs/pipelines aparecam nos resultados e sejam selecionados erroneamente.

### Solucao

Adicionar o parametro `originIds` aos hooks `useSearchDealsByPhone` e `useSearchDealsByEmail` em `src/hooks/useAgendaData.ts`, e passar esses IDs a partir do `QuickScheduleModal`.

### Arquivo: `src/hooks/useAgendaData.ts`

**`useSearchDealsByPhone`** (linha 758):
- Adicionar parametro opcional `originIds?: string[]`
- Ao buscar deals por `contact_id`, adicionar `.in('origin_id', originIds)` quando disponivel

**`useSearchDealsByEmail`** (linha 792):
- Adicionar parametro opcional `originIds?: string[]`
- Ao buscar deals por `contact_id`, adicionar `.in('origin_id', originIds)` quando disponivel

### Arquivo: `src/components/crm/QuickScheduleModal.tsx`

- Passar `originIds` para `useSearchDealsByPhone(phoneQuery, originIds)`
- Passar `originIds` para `useSearchDealsByEmail(emailQuery, originIds)`

### Arquivo: `src/components/crm/R2QuickScheduleModal.tsx`

- Verificar e aplicar o mesmo filtro de BU para consistencia
