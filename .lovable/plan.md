

## Simplificar a tabela de Performance Diária do SDR

### Problema
A tabela mostra 7 colunas, mas R1 Agendada, R1 Realizada e No-Show ficam com zeros porque esses eventos acontecem em datas futuras, não na data do agendamento. Isso gera uma tabela cheia de zeros que confunde em vez de informar.

Além disso, o gráfico de barras (`SdrMeetingsChart`) já mostra a evolução diária — há redundância visual entre gráfico e tabela.

### Solução

Simplificar a tabela para focar no que importa no dia-a-dia do SDR: **quantos agendamentos ele fez vs a meta**.

**Colunas da tabela simplificada:**

| Data | Agendamentos | Meta | Status |
|------|-------------|------|--------|

- **Agendamentos**: valor em destaque, com cor verde se ≥ meta, vermelho se <
- **Meta**: número da meta diária
- **Status**: ícone check/X

Isso é limpo, direto, e complementa os KPI cards (que já mostram os totais de R1 Agendada, R1 Realizada, No-Show e Contratos no período).

### Remover redundância do gráfico

O gráfico `SdrMeetingsChart` também mostra agendamentos por dia — mas com barras de "agendadas", "realizadas" e "noShow" que sofrem do mesmo problema de zeros. Vou simplificar o gráfico para mostrar apenas barras de **Agendamentos** com uma **linha de referência da meta diária**, tornando gráfico e tabela complementares em vez de redundantes.

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `SdrDailyBreakdownTable.tsx` | Simplificar: remover colunas R1 Agendada, R1 Realizada, No-Show. Manter Data, Agendamentos (com cor), Meta, Status |
| `SdrMeetingsChart.tsx` | Simplificar: só barra de Agendamentos + linha de referência da meta |

