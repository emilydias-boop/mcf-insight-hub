

## Correção: Meta de R2 Agendadas = 100% dos Contratos Pagos

### Problema
R2 Agendadas usa o branch genérico `meta_valor × diasUteisMes` (ex: 1/dia × 17 = 17), quando deveria usar **100% dos Contratos Pagos** como meta (neste caso, 47).

### Solução
Adicionar lógica específica para `r2_agendadas` no cálculo de `isDynamicCalc`, tanto no indicador visual quanto no cálculo do variável:

**Quando `nome_metrica === 'r2_agendadas'`:**
- Se `meta_percentual` estiver configurada → usar X% dos Contratos Pagos
- Senão → usar 100% dos Contratos Pagos como fallback

O valor de Contratos Pagos vem de `kpi?.intermediacoes_contrato` (mesmo campo usado pelo indicador de Contratos).

### Arquivos a editar

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `DynamicIndicatorCard.tsx` (linhas 100-114) | Adicionar branch `r2_agendadas`: meta = `meta_percentual`% (ou 100%) de `kpi.intermediacoes_contrato`, com subtitle explicativo |
| 2 | `useCalculatedVariavel.ts` (linhas 71-83) | Mesma lógica: meta de R2 Agendadas baseada em contratos pagos |

### Resultado esperado
- **Meta**: 47 (100% de 47 contratos pagos)
- **Realizado**: 50
- **%**: 106.4%
- Subtitle: `100% de 47 contratos = 47`

