

# Melhorar Detalhamento do Popup de Closer com Informacoes Completas

## Problema

O popup atual tem informacoes incompletas:
1. O KPI de Parcerias mostra apenas o bruto (R$ 53.500 para 31 parcerias), sem mostrar o liquido
2. A tabela "Detalhamento de Parcerias" mostra apenas Qtd e Bruto, faltando a coluna Liquido
3. Nao fica claro o valor real recebido em cada parceria

## Mudancas

### Arquivo: `src/components/relatorios/CloserRevenueDetailDialog.tsx`

1. **KPI Cards - Adicionar Liquido nos cards de Contratos e Parcerias**:
   - Card Contratos: mostrar bruto E liquido abaixo
   - Card Parcerias: mostrar bruto E liquido abaixo
   - Manter o mesmo padrao visual do card "Contribuicao Total" que ja mostra ambos

2. **Tabela Detalhamento de Parcerias - Adicionar coluna Liquido**:
   - Adicionar tracking de `net` no `parceriaMap` (atualmente so tem `count` e `gross`)
   - Nova coluna "Liquido" na tabela de parcerias
   - Linha de total no rodape da tabela

3. **Calculos**: Adicionar `net` ao acumulador do `parceriaMap` e `contractsNet`/`parceriasNet` nos calculos de metricas

## Secao Tecnica

### Mudancas no codigo

**parceriaMap** (linha 152-158): Adicionar campo `net` ao acumulador:
```text
// De: { count: 0, gross: 0 }
// Para: { count: 0, gross: 0, net: 0 }
```

**metrics return** (linhas 173-176): Adicionar `contractsNet` e `parceriasNet`:
```text
contracts: { count, gross, net }
parcerias: { count, gross, net }
```

**KPI Cards** (linhas 202-246): Adicionar linha de liquido nos cards de Contratos e Parcerias, seguindo o mesmo padrao do card Contribuicao Total

**Tabela de Parcerias** (linhas 317-339): Adicionar coluna Liquido + linha de total

