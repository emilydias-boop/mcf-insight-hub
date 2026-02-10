

# Adaptar Metas da Equipe para exibir stages das 2 pipelines do Consorcio

## Problema
O painel "Metas da Equipe" mostra labels do Incorporador (R2 Agendada, R2 Realizada, Contrato Pago, Vendas Realizadas). O Consorcio tem 2 pipelines com stages diferentes que precisam aparecer:

- **Efeito Alavanca + Clube**: Aguardando Doc, Carta Socios Fechada, Aporte Holding
- **Viver de Aluguel**: Proposta Enviada, Contrato Pago, Venda Realizada

## Solucao

Criar um componente dedicado `ConsorcioGoalsMatrixTable` com as metricas corretas para ambas as pipelines, e ajustar o modal de edicao para mostrar os labels do Consorcio.

### Nova tabela de metricas do Consorcio

| Metrica | Dia | Semana | Mes |
|---------|-----|--------|-----|
| Agendamento | x/meta | x/meta | x/meta |
| R1 Agendada | x/meta | x/meta | x/meta |
| R1 Realizada | x/meta | x/meta | x/meta |
| No-Show | x/meta | x/meta | x/meta |
| Proposta Enviada | x/meta | x/meta | x/meta |
| Contrato Pago | x/meta | x/meta | x/meta |
| Aguardando Doc | x/meta | x/meta | x/meta |
| Carta Socios Fechada | x/meta | x/meta | x/meta |
| Aporte Holding | x/meta | x/meta | x/meta |
| Venda Realizada | x/meta | x/meta | x/meta |

As 4 primeiras metricas (Agendamento a No-Show) vem da agenda. As demais vem da contagem de deals nos stages de cada pipeline.

## Detalhes Tecnicos

### 1. Arquivo novo: `src/components/sdr/ConsorcioGoalsMatrixTable.tsx`
- Componente que aceita um array flexivel de metricas (nao limitado a 8 keys fixas)
- Cada metrica tem: label, valores (dia/semana/mes) e targets (dia/semana/mes)
- Reutiliza o `MetricProgressCell` existente para as celulas
- Aceita uma prop opcional de sub-header para indicar de qual pipeline vem cada metrica

### 2. Arquivo novo: `src/hooks/useConsorcioPipelineMetrics.ts`
- Hook que busca contagens de deals por stage_id para os 2 pipelines do Consorcio
- Filtra por `moved_at` ou `updated_at` dentro do periodo (dia, semana, mes)
- Stage IDs referenciados:
  - Efeito Alavanca: Aguardando Doc (88b00163), Carta Socios (2963719b), Aporte Holding (4d323900), Carta+Aporte (fd4d30fc)
  - Viver de Aluguel: Proposta Enviada (09a0a99e), Contrato Pago (a35fea26), Venda Realizada (aa194279)
- Retorna contagens para dia, semana e mes

### 3. Arquivo modificado: `src/hooks/useSdrTeamTargets.ts`
- Adicionar `CONSORCIO_SDR_TARGET_CONFIGS` com os labels corretos:
  - `consorcio_sdr_proposta_enviada_dia/semana/mes` -> "Proposta Enviada"
  - `consorcio_sdr_aguardando_doc_dia/semana/mes` -> "Aguardando Doc"
  - `consorcio_sdr_carta_fechada_dia/semana/mes` -> "Carta Socios Fechada"
  - `consorcio_sdr_aporte_dia/semana/mes` -> "Aporte Holding"
  - Manter: agendamento, r1_agendada, r1_realizada, noshow, contrato, venda_realizada
- Exportar funcao `getTargetConfigsForBU(buPrefix)` para retornar o array correto

### 4. Arquivo modificado: `src/pages/bu-consorcio/PainelEquipe.tsx`
- Importar `ConsorcioGoalsMatrixTable` em vez de usar `TeamGoalsPanel` generico
- Importar e usar `useConsorcioPipelineMetrics` para dados de pipeline
- Combinar dados de agenda (agendamento, R1, no-show) com dados de pipeline (proposta, carta, aporte)
- Passar tudo ao novo componente

### 5. Arquivo modificado: `src/components/sdr/TeamGoalsEditModal.tsx`
- Quando `buPrefix = 'consorcio_sdr_'`, usar `CONSORCIO_SDR_TARGET_CONFIGS` em vez de `SDR_TARGET_CONFIGS`
- Labels dos inputs de meta refletirao os stages corretos do Consorcio
- Cascata de calculo adaptada para o fluxo do Consorcio

### Resultado
- Tabela de metas mostra as stages reais das 2 pipelines do Consorcio
- Modal de edicao mostra labels corretos
- Dados vem de 2 fontes: agenda (R1/no-show) + deals por stage (proposta, carta, aporte)
- Painel do Incorporador continua inalterado

