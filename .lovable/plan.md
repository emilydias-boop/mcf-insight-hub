# Adicionar canal "GUIA" no Funil por Canal

## Contexto

O webhook Hubla já cria leads do produto **Guia CAIXA** em Inside Sales com a tag `Guia` (ver `hubla-webhook-handler`, prioridade 0). Hoje esses leads caem em **OUTROS** no relatório `/bu-incorporador/relatorios` porque o classificador em `useChannelFunnelReport.ts` não reconhece a tag.

Objetivo: criar uma nova linha **GUIA** na tabela (Canal × Entradas / R1 Agend. / R1 Realiz. / No-Show / Contrato Pago) para acompanhar o desempenho desse novo canal em cada estágio.

## Mudanças

### 1. `src/hooks/useChannelFunnelReport.ts`
- Adicionar `GUIA: 'GUIA'` ao mapa de canais e ao tipo `ChannelKey`.
- Adicionar constante `GUIA_TAGS = ['GUIA']` (match exato após normalização, mesmo padrão de PLANILHA/ANAMNESE).
- No `classifyLead`, inserir a regra **antes** de PLANILHA e depois de ANAMNESE/ANAMNESE_INCOMPLETA:
  - Se `hasGuiaTag` e não é buyer A010/A017 → retorna `GUIA`.
  - Um lead que também comprou A010/A017 permanece nesses canais (compra prevalece sobre tag de origem).
- Incluir `'GUIA'` em `FUNNEL_CHANNELS` (linha 888) e no objeto de detalhes `blankDetails` (linha 960) para que a linha seja renderizada mesmo com zero.

### 2. `src/components/relatorios/AcquisitionReportPanel.tsx` (e demais painéis que listam canais)
- Adicionar `GUIA` na ordem de exibição da tabela (entre `ANAMNESE` e `PLANILHA`, ou onde fizer sentido visual).
- Se houver ícone/cor por canal, adicionar um estilo próprio (ex.: laranja) para GUIA.

### 3. Drilldowns
- `FunnelCellDrillModal.tsx`, `SdrDailyDrilldownDialog.tsx`, `CloserDailyDrilldownDialog.tsx`: se filtram por canal, incluir `GUIA` na lista.

## Fora de escopo
- Não alterar o webhook Hubla (tag `Guia` já está sendo aplicada).
- Não mexer em Painel Comercial / metas SDR.
- Backfill: leads Guia antigos que já estão com a tag `Guia` passam a aparecer automaticamente na linha GUIA a partir do momento em que o classificador mudar — não é necessário migration.

## Perguntas rápidas
1. A ordem correta na tabela é **A010 → OUTROS → ANAMNESE → GUIA → PLANILHA → A017 → ANAMNESE INCOMPLETA**, ou você prefere GUIA logo abaixo de A010?
2. Um lead com tag `Guia` que também comprou A010 deve contar em **A010** (regra atual, compra prevalece) ou em **GUIA**?
