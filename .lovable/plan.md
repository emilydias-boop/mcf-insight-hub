

# Excluir Vendas Outside do Faturamento por Closer

## Problema

A tabela "Faturamento por Closer" atribui todas as transacoes ao closer baseado apenas no match de email/telefone com a agenda. Isso inclui vendas **Outside** (leads que pagaram ANTES da reuniao de R1), inflando os numeros de transacoes e faturamento de cada closer.

## Solucao

Adicionar deteccao de Outside na logica de atribuicao da tabela. Transacoes Outside serao separadas em colunas dedicadas, mantendo a visibilidade sem poluir as metricas de desempenho real.

## Mudancas

### 1. Detectar Outside na atribuicao (CloserRevenueSummaryTable.tsx)

Quando uma transacao faz match com um closer por email/telefone, verificar se a data da venda (`sale_date`) e anterior a data da reuniao mais antiga desse lead com o closer (`scheduled_at` do attendee correspondente). Se for, classificar como Outside.

Para isso, o componente precisa receber as datas das reunioes dos attendees. A informacao ja esta parcialmente disponivel via `attendees` (que contem `meeting_slots`), mas falta o campo `scheduled_at`.

### 2. Expandir dados do attendee

Atualizar a query que alimenta o `attendees` no `SalesReportPanel.tsx` para incluir `scheduled_at` do `meeting_slots`, permitindo a comparacao de datas.

### 3. Adicionar colunas Outside na tabela

Adicionar duas colunas ao "Faturamento por Closer":
- **Outside** - contagem de transacoes Outside por closer
- **Fat. Outside** - faturamento bruto dessas transacoes

Esses valores ficam separados das metricas regulares do closer.

### 4. Logica de separacao

```text
Para cada transacao com match de closer:
  1. Buscar o attendee correspondente (por email/telefone)
  2. Comparar sale_date da transacao com scheduled_at da reuniao
  3. Se sale_date < scheduled_at -> Outside (nao conta em Transacoes/Bruto/Liquido regulares)
  4. Se sale_date >= scheduled_at -> Venda normal (conta normalmente)
```

## Detalhes Tecnicos

### Arquivos a modificar

1. **`src/components/relatorios/SalesReportPanel.tsx`** - Incluir `scheduled_at` na query de attendees
2. **`src/components/relatorios/CloserRevenueSummaryTable.tsx`** - Adicionar logica de deteccao Outside na atribuicao, novas colunas na tabela, e separar os totais
3. **`src/components/relatorios/CloserRevenueDetailDialog.tsx`** - Marcar transacoes Outside no detalhe

### Interface AttendeeMatch atualizada

Adicionar `meeting_slots.scheduled_at` ao tipo `AttendeeMatch` para que a data da reuniao esteja disponivel na logica de comparacao.

### Resultado esperado

- Numeros dos closers refletem apenas vendas reais (pos-reuniao)
- Vendas Outside ficam visiveis em colunas separadas
- Total geral da tabela continua batendo com o faturamento total do periodo
