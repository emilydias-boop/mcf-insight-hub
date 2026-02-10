
# Tabela SDR Especifica para Consorcio

## Problema
A tabela de SDRs no Painel Equipe do Consorcio usa o componente generico `SdrSummaryTable` do Incorporador, com colunas como "Contrato PAGO" e "Taxa Contrato" que nao fazem sentido para o fluxo do Consorcio.

## Colunas desejadas (Consorcio)
| SDR | Meta | Agendamento | R1 Agendada | R1 Realizada | No-Show | Proposta Enviada | Taxa Venda | Taxa Conv. | > |

- **Meta**: meta diaria x dias uteis (igual ao atual)
- **Agendamento**: reunioes criadas no periodo
- **R1 Agendada**: reunioes agendadas para o periodo
- **R1 Realizada**: reunioes realizadas
- **No-Show**: com percentual sobre agendada
- **Proposta Enviada**: deals na stage "Proposta Enviada" do pipeline Viver de Aluguel, atribuidos ao SDR via `crm_deals.owner_id` (que armazena o email do SDR)
- **Taxa Venda**: Contratos / R1 Realizada (taxa de conversao sobre venda)
- **Taxa Conv.**: R1 Realizada / R1 Agendada (taxa de conversao de agendada para realizada)

## O que sera feito

### 1. Hook `useConsorcioPipelineMetricsBySdr`
Novo hook que busca deals na stage "Proposta Enviada" agrupados por `owner_id` (email do SDR), filtrado pelo periodo selecionado. Retorna um `Map<string, number>` de email para contagem.

### 2. Componente `ConsorcioSdrSummaryTable`
Novo componente de tabela especifico para o Consorcio com as colunas corretas:
- Remove colunas "Contrato PAGO", "Taxa Contrato", "Ghost"
- Adiciona coluna "Proposta Enviada" com dados do novo hook
- "Taxa Venda" = Contratos / R1 Realizada
- "Taxa Conv." = R1 Realizada / R1 Agendada
- Mantém navegacao para detalhe do SDR e comportamento de click

### 3. Alterar `PainelEquipe.tsx`
Substituir `SdrSummaryTable` pelo novo `ConsorcioSdrSummaryTable`, passando os dados necessarios incluindo as propostas por SDR.

## Detalhes Tecnicos

### Novo: `src/hooks/useConsorcioPipelineMetricsBySdr.ts`
- Consulta `crm_deals` filtrada por `stage_id = '09a0a99e-feee-46df-a817-bc4d0e1ac3d9'` (Proposta Enviada)
- Filtra por `stage_moved_at` dentro do periodo selecionado
- Agrupa por `owner_id` (que contem o email do SDR)
- Retorna `Map<string, number>` para lookup rapido na tabela

### Novo: `src/components/sdr/ConsorcioSdrSummaryTable.tsx`
- Recebe as mesmas props base (`data: SdrSummaryRow[]`, `sdrMetaMap`, `diasUteisNoPeriodo`, etc.)
- Prop adicional: `propostasEnviadasBySdr: Map<string, number>`
- Tabela com 9 colunas + navegacao
- Sem coluna Ghost (especifica do Incorporador)

### Alteracao: `src/pages/bu-consorcio/PainelEquipe.tsx`
- Importar e usar `useConsorcioPipelineMetricsBySdr` com as datas do periodo
- Importar `ConsorcioSdrSummaryTable` em vez de `SdrSummaryTable`
- Passar `propostasEnviadasBySdr` como prop
